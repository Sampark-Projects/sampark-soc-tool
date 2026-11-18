import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Upload from './pages/Upload'
import Accounts from './pages/Accounts'
import AccountLogin from './pages/AccountLogin'
import AccountPassword from './pages/AccountPassword'
import Kiosk from './pages/Kiosk'
import Dashboards from './pages/Dashboards'
import Sessions from './pages/Sessions'
import Assets from './pages/Assets'
import Files from './pages/Files'
import DashboardView from './pages/DashboardView'
import Status from './pages/Status'
import Explorer from './pages/Explorer'
import Connections from './pages/Connections'
import Statistics from './pages/Statistics'
import Hunts from './pages/Hunts'
import ArkimeSettings from './pages/Settings'
import Spiview from './pages/Spiview'
import AssetDetail from './pages/AssetDetail'
import Landing from './pages/Landing'
import Management from './pages/Management'
import SavedObject from './pages/SavedObject'
import Console from './pages/Console'
import SavedDashboard from './pages/SavedDashboard'
import PluginObject from './pages/PluginObject'
import ErrorPage from './pages/ErrorPage'

// Each route is filled in by its own part of the migration.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboards" element={<Dashboards />} />
        <Route path="/dashboards/saved/:id" element={<SavedDashboard />} />
        <Route path="/dashboards/:slug" element={<DashboardView />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/status" element={<Status />} />
        <Route path="/spiview" element={<Spiview />} />
        <Route path="/hunts" element={<Hunts />} />
        <Route path="/settings" element={<ArkimeSettings />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/sessions" element={<Sessions />} />
        <Route path="/assets/:kind/:id" element={<AssetDetail />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/files" element={<Files />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/login" element={<AccountLogin />} />
        <Route path="/accounts/password" element={<AccountPassword />} />
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/management" element={<Management />} />
        <Route path="/management/plugin/:kind/:id" element={<PluginObject />} />
        <Route path="/management/:type/:id" element={<SavedObject />} />
        <Route path="/console" element={<Console />} />
        <Route path="/401" element={<ErrorPage code={401} />} />
        <Route path="/502" element={<ErrorPage code={502} />} />
        <Route path="*" element={<ErrorPage code={404} />} />
      </Route>
    </Routes>
  )
}
