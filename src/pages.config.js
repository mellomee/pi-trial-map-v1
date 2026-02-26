/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AdmittedExhibits from './pages/AdmittedExhibits';
import BattleCards from './pages/BattleCards';
import Dashboard from './pages/Dashboard';
import DepositionExhibits from './pages/DepositionExhibits';
import Exhibits from './pages/Exhibits';
import Export from './pages/Export';
import Import from './pages/Import';
import JointExhibits from './pages/JointExhibits';
import MasterExhibits from './pages/MasterExhibits';
import Parties from './pages/Parties';
import Questions from './pages/Questions';
import Runner from './pages/Runner';
import SettingsPage from './pages/SettingsPage';
import Transcripts from './pages/Transcripts';
import TrialPoints from './pages/TrialPoints';
import TrialPointDetail from './pages/TrialPointDetail';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdmittedExhibits": AdmittedExhibits,
    "BattleCards": BattleCards,
    "Dashboard": Dashboard,
    "DepositionExhibits": DepositionExhibits,
    "Exhibits": Exhibits,
    "Export": Export,
    "Import": Import,
    "JointExhibits": JointExhibits,
    "MasterExhibits": MasterExhibits,
    "Parties": Parties,
    "Questions": Questions,
    "Runner": Runner,
    "SettingsPage": SettingsPage,
    "Transcripts": Transcripts,
    "TrialPoints": TrialPoints,
    "TrialPointDetail": TrialPointDetail,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};