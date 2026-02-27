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
import ExhibitDetail from './pages/ExhibitDetail';
import Exhibits from './pages/Exhibits';
import Export from './pages/Export';
import Import from './pages/Import';
import JointExhibitPrint from './pages/JointExhibitPrint';
import JointExhibits from './pages/JointExhibits';
import MasterExhibits from './pages/MasterExhibits';
import Parties from './pages/Parties';
import QuestionDetail from './pages/QuestionDetail';
import Questions from './pages/Questions';
import Runner from './pages/Runner';
import SettingsPage from './pages/SettingsPage';
import Transcripts from './pages/Transcripts';
import TrialPointDetail from './pages/TrialPointDetail';
import TrialPoints from './pages/TrialPoints';
import TrialRunner from './pages/TrialRunner';
import VideoLibrary from './pages/VideoLibrary';
import VideoClipEditor from './pages/VideoClipEditor';
import VideoHub from './pages/VideoHub';
import PresentationMode from './pages/PresentationMode';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdmittedExhibits": AdmittedExhibits,
    "BattleCards": BattleCards,
    "Dashboard": Dashboard,
    "DepositionExhibits": DepositionExhibits,
    "ExhibitDetail": ExhibitDetail,
    "Exhibits": Exhibits,
    "Export": Export,
    "Import": Import,
    "JointExhibitPrint": JointExhibitPrint,
    "JointExhibits": JointExhibits,
    "MasterExhibits": MasterExhibits,
    "Parties": Parties,
    "QuestionDetail": QuestionDetail,
    "Questions": Questions,
    "Runner": Runner,
    "SettingsPage": SettingsPage,
    "Transcripts": Transcripts,
    "TrialPointDetail": TrialPointDetail,
    "TrialPoints": TrialPoints,
    "TrialRunner": TrialRunner,
    "VideoLibrary": VideoLibrary,
    "VideoClipEditor": VideoClipEditor,
    "VideoHub": VideoHub,
    "PresentationMode": PresentationMode,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};