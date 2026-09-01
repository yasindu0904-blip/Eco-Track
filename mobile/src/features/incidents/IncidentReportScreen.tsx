import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import {
  Button,
  Field,
  Notice,
  PageHeader,
  Screen,
  sharedStyles,
} from "../../components/ui";
import { colors, spacing } from "../../components/theme";
import {
  AdministrativeAreaMapSearch,
  COLOMBO_MAP_CENTER,
  LocationPicker,
  type MapBoundaryFeatureCollection,
  type MapLocation,
} from "../map";
import {
  createIncident,
  listIncidentCategories,
  uploadEvidence,
} from "./incident.api";
import type {
  IncidentCategory,
  IncidentDetail,
  IncidentSeverity,
  MobileIncidentPhoto,
  UploadedEvidence,
} from "./incident.types";

type Props = {
  accessToken: string;
  onBack: () => void;
  onSubmitted: (incident: IncidentDetail) => void;
};

const severities: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function createUuid(): string {
  const random = () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0");
  return `${random()}${random()}-${random()}-4${random().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${random().slice(1)}-${random()}${random()}${random()}`;
}

export function IncidentReportScreen({
  accessToken,
  onBack,
  onSubmitted,
}: Props) {
  const [categories, setCategories] = useState<IncidentCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [severity, setSeverity] = useState<IncidentSeverity>("MEDIUM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addressText, setAddressText] = useState("");
  const [location, setLocation] = useState<MapLocation>(COLOMBO_MAP_CENTER);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [searchedBoundary, setSearchedBoundary] =
    useState<MapBoundaryFeatureCollection>();
  const [photos, setPhotos] = useState<MobileIncidentPhoto[]>([]);
  const [uploaded, setUploaded] = useState<UploadedEvidence[]>([]);
  const [submissionId] = useState(createUuid);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);

  useEffect(() => {
    let active = true;
    void listIncidentCategories(accessToken)
      .then((items) => {
        if (!active) return;
        setCategories(items);
        setCategoryId(items[0]?.id ?? "");
      })
      .catch((loadError: unknown) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load categories.",
          );
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  async function choosePhotos() {
    setError(null);
    const remainingSlots = 5 - photos.length;
    if (remainingSlots <= 0) {
      setError("Remove a photo before adding another one.");
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        "Photo-library permission is needed to attach incident evidence.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.9,
    });
    if (result.canceled) return;
    setBusy(true);
    setMessage("Compressing selected photos…");
    try {
      const prepared: MobileIncidentPhoto[] = [];
      for (const [index, asset] of result.assets
        .slice(0, remainingSlots)
        .entries()) {
        const resized = await manipulateAsync(
          asset.uri,
          asset.width > 1600 ? [{ resize: { width: 1600 } }] : [],
          { compress: 0.72, format: SaveFormat.JPEG },
        );
        const data = await (await fetch(resized.uri)).arrayBuffer();
        if (data.byteLength > 8 * 1024 * 1024) {
          throw new Error(
            `${asset.fileName ?? `Photo ${index + 1}`} is still larger than 8 MB after compression.`,
          );
        }
        prepared.push({
          uri: resized.uri,
          originalFileName: `${(asset.fileName ?? `incident-${index + 1}`).replace(/\.[^.]+$/, "")}.jpg`,
          contentType: "image/jpeg",
          sizeBytes: data.byteLength,
          data,
        });
      }
      setPhotos((current) => [...current, ...prepared].slice(0, 5));
      setUploaded([]);
      setMessage(
        `${prepared.length} compressed ${prepared.length === 1 ? "photo" : "photos"} ready.`,
      );
    } catch (photoError) {
      setError(
        photoError instanceof Error
          ? photoError.message
          : "The selected photos could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function takePhoto() {
    setError(null);
    if (photos.length >= 5) {
      setError("Remove a photo before taking another one.");
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Camera permission is needed to photograph incident evidence.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      cameraType: ImagePicker.CameraType.back,
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset) return;
    setBusy(true);
    setMessage("Preparing camera photo…");
    try {
      const resized = await manipulateAsync(
        asset.uri,
        asset.width > 1600 ? [{ resize: { width: 1600 } }] : [],
        { compress: 0.72, format: SaveFormat.JPEG },
      );
      const data = await (await fetch(resized.uri)).arrayBuffer();
      if (data.byteLength > 8 * 1024 * 1024)
        throw new Error(
          "The camera photo is still larger than 8 MB after compression.",
        );
      const photo: MobileIncidentPhoto = {
        uri: resized.uri,
        originalFileName: `${(asset.fileName ?? `incident-camera-${Date.now()}`).replace(/\.[^.]+$/, "")}.jpg`,
        contentType: "image/jpeg",
        sizeBytes: data.byteLength,
        data,
      };
      setPhotos((current) => [...current, photo].slice(0, 5));
      setUploaded([]);
      setMessage("Camera photo ready.");
    } catch (photoError) {
      setError(
        photoError instanceof Error
          ? photoError.message
          : "The camera photo could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }

  function removePhoto(uri: string) {
    setPhotos((current) => current.filter((photo) => photo.uri !== uri));
    setUploaded([]);
    setError(null);
    setMessage("Photo removed.");
  }

  async function submit() {
    if (
      !categoryId ||
      title.trim().length < 3 ||
      description.trim().length < 10
    ) {
      setError("Choose a category and provide a title and clear description.");
      return;
    }
    if (!locationConfirmed) {
      setError("Confirm the incident location before submitting.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let evidence = uploaded;
      if (photos.length > 0 && evidence.length !== photos.length) {
        evidence = await uploadEvidence(
          accessToken,
          submissionId,
          photos,
          (complete, total, name) => {
            setMessage(`Uploading ${name}: ${complete} of ${total} complete`);
          },
        );
        setUploaded(evidence);
      }
      setMessage("Saving your report…");
      onSubmitted(
        await createIncident(accessToken, {
          submissionId,
          categoryId,
          title: title.trim(),
          description: description.trim(),
          severity,
          latitude: location.latitude,
          longitude: location.longitude,
          addressText: addressText.trim() || undefined,
          evidence,
        }),
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The incident could not be submitted. Your form is preserved for retry.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scrollEnabled={!mapInteracting}>
      <PageHeader
        eyebrow="Community report"
        title="Report an incident"
        subtitle="Confirm the location and share evidence that helps nearby organizations understand the concern."
        onBack={onBack}
        backLabel="Dashboard"
      />
      {error ? <Notice message={error} tone="error" /> : null}
      {message ? <Notice message={message} tone="info" /> : null}

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>1. What did you find?</Text>
        <View style={styles.optionGrid}>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[
                styles.option,
                categoryId === category.id && styles.optionSelected,
              ]}
            >
              <Text style={styles.optionTitle}>{category.name}</Text>
              <Text style={styles.optionHelp}>{category.description}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Severity</Text>
        <View style={styles.severityRow}>
          {severities.map((item) => (
            <Pressable
              key={item}
              onPress={() => setSeverity(item)}
              style={[
                styles.severity,
                severity === item && styles.severitySelected,
              ]}
            >
              <Text
                style={[
                  styles.severityText,
                  severity === item && styles.severityTextSelected,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>2. Describe the incident</Text>
        <Field
          label="Incident title"
          required
          value={title}
          onChangeText={setTitle}
          placeholder="Plastic waste blocking a canal"
        />
        <Field
          label="Description"
          required
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the affected area and immediate hazards…"
        />
        <Field
          label="Address or landmark"
          value={addressText}
          onChangeText={setAddressText}
          placeholder="Optional nearby landmark"
        />
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>3. Confirm the location</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Use the middle location icon or move the map beneath the black pin.
        </Text>
        <AdministrativeAreaMapSearch
          accessToken={accessToken}
          onBoundaryChange={setSearchedBoundary}
        />
        <LocationPicker
          value={location}
          boundaries={searchedBoundary}
          disabled={busy}
          confirmed={locationConfirmed}
          confirmLabel={
            locationConfirmed
              ? "✓ Location confirmed"
              : "Confirm incident location"
          }
          onMapInteractionChange={setMapInteracting}
          onChange={(next) => {
            setLocation(next);
            setLocationConfirmed(false);
          }}
          onConfirm={(next) => {
            setLocation(next);
            setLocationConfirmed(true);
          }}
        />
      </View>

      <View style={sharedStyles.card}>
        <Text style={sharedStyles.sectionTitle}>4. Photo evidence</Text>
        <Text style={sharedStyles.sectionSubtitle}>
          Choose up to 5 photos. Images are resized and compressed before
          upload.
        </Text>
        <Button
          label="Take photo"
          disabled={busy || photos.length >= 5}
          onPress={() => void takePhoto()}
        />
        <Button
          label={photos.length ? "Add from library" : "Choose from library"}
          variant="secondary"
          disabled={busy || photos.length >= 5}
          onPress={() => void choosePhotos()}
        />
        {photos.length > 0 ? (
          <View style={styles.photoGrid}>
            {photos.map((photo) => (
              <View key={photo.uri} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photo} />
                <Text numberOfLines={1} style={styles.photoName}>
                  {photo.originalFileName}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${photo.originalFileName}`}
                  disabled={busy}
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(photo.uri)}
                >
                  <Text style={styles.removePhotoText}>Remove</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Button
        label="Submit incident report"
        loading={busy}
        disabled={!locationConfirmed || categories.length === 0}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  optionGrid: { gap: spacing.sm },
  option: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  optionTitle: { color: colors.text, fontWeight: "800" },
  optionHelp: { marginTop: 4, color: colors.textMuted, lineHeight: 19 },
  label: { color: colors.text, fontWeight: "800" },
  severityRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  severity: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
  },
  severitySelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  severityText: { color: colors.textMuted, fontSize: 12, fontWeight: "800" },
  severityTextSelected: { color: colors.surface },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoItem: {
    overflow: "hidden",
    width: "47%",
    gap: 6,
    paddingBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  photo: { width: "100%", aspectRatio: 1.2, borderRadius: 10 },
  photoName: {
    paddingHorizontal: spacing.xs,
    color: colors.textMuted,
    fontSize: 11,
  },
  removePhotoButton: {
    alignSelf: "flex-start",
    marginHorizontal: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
  },
  removePhotoText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
});
