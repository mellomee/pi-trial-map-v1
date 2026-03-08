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
import AnnotatePage from './pages/AnnotatePage';
import BattleCards from './pages/BattleCards';
import Dashboard from './pages/Dashboard';
import DepoClips from './pages/DepoClips';
import DepositionExhibits from './pages/DepositionExhibits';
import ExhibitDetail from './pages/ExhibitDetail';
import Exhibits from './pages/Exhibits';
import Export from './pages/Export';
import Extracts from './pages/Extracts';
import Import from './pages/Import';
import JointExhibitPrint from './pages/JointExhibitPrint';
import JointExhibits from './pages/JointExhibits';
import MasterExhibits from './pages/MasterExhibits';
import Parties from './pages/Parties';
import Present from './pages/Present';
import PresentationMode from './pages/PresentationMode';
import PrintDepoClips from './pages/PrintDepoClips';
import PrintProofLibrary from './pages/PrintProofLibrary';
import PrintQuestions from './pages/PrintQuestions';
import ProofLibrary from './pages/ProofLibrary';
import QuestionDetail from './pages/QuestionDetail';
import Questions from './pages/Questions';
import Runner from './pages/Runner';
import SettingsPage from './pages/SettingsPage';
import Transcripts from './pages/Transcripts';
import TrialPointDetail from './pages/TrialPointDetail';
import TrialPoints from './pages/TrialPoints';
import TrialRunner from './pages/TrialRunner';
import VideoClipEditor from './pages/VideoClipEditor';
import VideoHub from './pages/VideoHub';
import VideoLibrary from './pages/VideoLibrary';
import TrialMode from './pages/TrialMode';
import JuryView from './pages/JuryView';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdmittedExhibits": AdmittedExhibits,
    "AnnotatePage": AnnotatePage,
    "BattleCards": BattleCards,
    "Dashboard": Dashboard,
    "DepoClips": DepoClips,
    "DepositionExhibits": DepositionExhibits,
    "ExhibitDetail": ExhibitDetail,
    "Exhibits": Exhibits,
    "Export": Export,
    "Extracts": Extracts,
    "Import": Import,
    "JointExhibitPrint": JointExhibitPrint,
    "JointExhibits": JointExhibits,
    "MasterExhibits": MasterExhibits,
    "Parties": Parties,
    "Present": Present,
    "PresentationMode": PresentationMode,
    "PrintDepoClips": PrintDepoClips,
    "PrintProofLibrary": PrintProofLibrary,
    "PrintQuestions": PrintQuestions,
    "ProofLibrary": ProofLibrary,
    "QuestionDetail": QuestionDetail,
    "Questions": Questions,
    "Runner": Runner,
    "SettingsPage": SettingsPage,
    "Transcripts": Transcripts,
    "TrialPointDetail": TrialPointDetail,
    "TrialPoints": TrialPoints,
    "TrialRunner": TrialRunner,
    "VideoClipEditor": VideoClipEditor,
    "VideoHub": VideoHub,
    "VideoLibrary": VideoLibrary,
    "TrialMode": TrialMode,
    "JuryView": JuryView,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};