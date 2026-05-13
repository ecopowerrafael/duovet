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
import Agenda from './pages/Agenda';
import Login from './pages/Login';
import AnimalDetail from './pages/AnimalDetail';
import Animals from './pages/Animals';
import AppointmentDetail from './pages/AppointmentDetail';
import Appointments from './pages/Appointments';
import ClientDetail from './pages/ClientDetail';
import Clients from './pages/Clients';
import Consultorias from './pages/Consultorias';
import Dashboard from './pages/Dashboard';
import Financial from './pages/Financial';
import Inventory from './pages/Inventory';
import Invoices from './pages/Invoices';
import MySubscription from './pages/MySubscription';
import NewAppointment from './pages/NewAppointment';
import NotificationSettings from './pages/NotificationSettings';
import Onboarding from './pages/Onboarding';
import Plans from './pages/Plans';
import Prescriptions from './pages/Prescriptions';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import Protocols from './pages/Protocols';
import RecurringContracts from './pages/RecurringContracts';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SubscriptionRequired from './pages/SubscriptionRequired';
import SyncStatus from './pages/SyncStatus';
import TeamManagement from './pages/TeamManagement';
import Notifications from './pages/Notifications';
import Tickets from './pages/Tickets';
import __Layout from './Layout.jsx';


import AdminPanel from './pages/AdminPanel';
import AuthCallback from './pages/AuthCallback';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Privacy from './pages/Privacy';
import Termos from './pages/Termos';
import LandingPage from './pages/LandingPage';

export const PAGES = {
    "admin-panel": AdminPanel,
    "auth-callback": AuthCallback,
    "register": Register,
    "forgot-password": ForgotPassword,
    "reset-password": ResetPassword,
    "privacy": Privacy,
    "termos": Termos,
    "landing": LandingPage,
    "agenda": Agenda,
    "login": Login,
    "animal-detail": AnimalDetail,
    "animals": Animals,
    "appointment-detail": AppointmentDetail,
    "appointments": Appointments,
    "client-detail": ClientDetail,
    "clients": Clients,
    "consultorias": Consultorias,
    "dashboard": Dashboard,
    "financial": Financial,
    "invoices": Invoices,
    "inventory": Inventory,
    "my-subscription": MySubscription,
    "new-appointment": NewAppointment,
    "notification-settings": NotificationSettings,
    "onboarding": Onboarding,
    "plans": Plans,
    "prescriptions": Prescriptions,
    "properties": Properties,
    "property-detail": PropertyDetail,
    "protocols": Protocols,
    "recurring-contracts": RecurringContracts,
    "reports": Reports,
    "settings": Settings,
    "subscription-required": SubscriptionRequired,
    "sync-status": SyncStatus,
    "team-management": TeamManagement,
    "notifications": Notifications,
    "tickets": Tickets,
}

export const pagesConfig = {
    mainPage: "landing",
    Pages: PAGES,
    Layout: __Layout,
};
