import { Toaster } from 'react-hot-toast'
import { KioskProvider, useKiosk } from './context/KioskContext'
import HomePanel from './panels/HomePanel'
import CardPanel from './panels/CardPanel'
import CalorieSetPanel from './panels/CalorieSetPanel'
import MealSuggestionPanel from './panels/MealSuggestionPanel'
import FoodBrowserPanel from './panels/FoodBrowserPanel'
import MapPanel from './panels/MapPanel'
import CampaignsPanel from './panels/CampaignsPanel'
import TopUpPanel from './panels/TopUpPanel'
import EmergencyModal from './panels/EmergencyModal'

function KioskRouter() {
  const { panel, showEmergency } = useKiosk()

  return (
    <>
      {panel === 'home'            && <HomePanel />}
      {panel === 'card'            && <CardPanel />}
      {panel === 'calorie-set'     && <CalorieSetPanel />}
      {panel === 'meal-suggestion' && <MealSuggestionPanel />}
      {panel === 'food-browser'    && <FoodBrowserPanel />}
      {panel === 'map'             && <MapPanel />}
      {panel === 'campaigns'       && <CampaignsPanel />}
      {panel === 'top-up'          && <TopUpPanel />}

      {showEmergency && <EmergencyModal />}
    </>
  )
}

export default function App() {
  return (
    <KioskProvider>
      <KioskRouter />
      <Toaster position="top-center" />
    </KioskProvider>
  )
}
