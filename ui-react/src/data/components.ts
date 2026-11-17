// Product components and the one-line label shown for each, everywhere in the app.
export const COMPONENTS: { name: string; label: string }[] = [
  { name: 'Arkime', label: 'PCAP & Indexing' },
  { name: 'Moloch', label: 'PCAP & Indexing' },
  { name: 'Zeek', label: 'Traffic Monitoring' },
  { name: 'Suricata', label: 'IDS/IPS/NSM Engine' },
  { name: 'Hedgehog Linux', label: 'Linux' },
  { name: 'OpenSearch', label: 'threat hunting and data visualization' },
  { name: 'CyberChef', label: 'Browser Decoder' },
  { name: 'Vega', label: 'interactive diagram,' },
  { name: 'Filebeat', label: 'lightweight log shipper' },
  { name: 'Fluent Bit', label: 'Log and metrics processor' },
  { name: 'NetBox', label: 'IRM/IPAM/DCIM' },
  { name: 'Valkey', label: 'in-memory' },
  { name: 'GeoLite2', label: 'geolocation database' },
  { name: 'Strelka', label: 'threat hunting' },
  { name: 'YARA', label: 'pattern-matching tool' },
  { name: 'Capa', label: 'Executable analysis' },
  { name: 'ClamAV', label: 'antivirus engine' },
  { name: 'FilePond', label: 'File upload' },
  { name: 'Keycloak', label: 'AD/LDAP' },
  { name: 'Sampark SOC Tool', label: 'network traffic analysis suite' },
]

export const labelOf = (name: string): string | undefined =>
  COMPONENTS.find((c) => c.name.toLowerCase() === name.toLowerCase())?.label
