type EcoTrackMarkProps = {
  className?: string;
};

export function EcoTrackMark({ className }: EcoTrackMarkProps) {
  return <img className={className} src="/favicon.svg" alt="" aria-hidden="true" />;
}
