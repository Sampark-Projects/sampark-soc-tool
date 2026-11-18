// Product components and the name shown for each, everywhere in the app.
export const COMPONENTS: { name: string; label: string }[] = [
  { name: 'Arkime', label: 'PacketVault' },
  { name: 'Moloch', label: 'PacketVault' },
  { name: 'Zeek', label: 'ProtocolInspector' },
  { name: 'Suricata', label: 'ThreatGuard IDS' },
  { name: 'Hedgehog Linux', label: 'EdgeSensor OS' },
  { name: 'OpenSearch', label: 'LogAnalytics Engine' },
  { name: 'CyberChef', label: 'DataDecoder Workbench' },
  { name: 'Vega', label: 'GraphStudio' },
  { name: 'Filebeat', label: 'LogCollector' },
  { name: 'Fluent Bit', label: 'StreamRouter' },
  { name: 'NetBox', label: 'AssetRegistry' },
  { name: 'Valkey', label: 'FastCache Store' },
  { name: 'GeoLite2', label: 'GeoMapper' },
  { name: 'Strelka', label: 'FileExtractor' },
  { name: 'YARA', label: 'SignatureMatcher' },
  { name: 'Capa', label: 'BehaviorAnalyzer' },
  { name: 'ClamAV', label: 'MalwareScanner' },
  { name: 'FilePond', label: 'ArtifactUploader' },
  { name: 'Keycloak', label: 'IdentityGateway' },
  { name: 'Malcolm', label: 'NetSight Core' },
]

export const labelOf = (name: string): string | undefined =>
  COMPONENTS.find((c) => c.name.toLowerCase() === name.toLowerCase())?.label
