export type AdministrativeAreaDto = {
  id: string;
  officialCode: string;
  name: string;
  gnNumber: string | null;
  divisionalSecretariatName: string | null;
  districtName: string | null;
  provinceName: string | null;
};

export type ListAdministrativeAreasQuery = {
  search?: string;
  limit: number;
};
