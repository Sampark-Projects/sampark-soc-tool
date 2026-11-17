import PageHero from '../components/PageHero'
import ManagementDashboards from './ManagementDashboards'

// All dashboards on the server (prebuilt and custom) as a searchable gallery.
export default function Dashboards() {
  return (
    <>
      <PageHero icon="📊" title="Dashboards" sub="Pick a dashboard to explore your network traffic and security events. Everything here runs locally on live data." to="/management" linkLabel="Management →" />
      <ManagementDashboards />
    </>
  )
}
