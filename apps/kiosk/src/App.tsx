import { Toaster } from 'react-hot-toast'
import { KioskProvider, useKiosk } from './context/KioskContext'
import IdlePanel from './panels/IdlePanel'
import CardPanel from './panels/CardPanel'
import CampaignsPanel from './panels/CampaignsPanel'
import MapPanel from './panels/MapPanel'

function KioskRouter() {
  const { panel } = useKiosk()

  switch (panel) {
    case 'idle':      return <IdlePanel />
    case 'card':      return <CardPanel />
    case 'campaigns': return <CampaignsPanel />
    case 'map':       return <MapPanel />
    default:          return <IdlePanel />
  }
}

export default function App() {
  return (
    <KioskProvider>
      <KioskRouter />
      <Toaster position="top-center" />
    </KioskProvider>
  )
}
