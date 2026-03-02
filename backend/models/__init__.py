"""Modèles de données Pydantic"""
from models.user import (
    UserBase, UserCreate, UserUpdate, User, UserLogin, Token,
    ManagerPermissions, EmployeeVisibility
)
from models.centre import (
    CentreConfig, CentreBase, CentreCreate, Centre, CentreUpdate,
    InscriptionRequest, Inscription
)
from models.planning import (
    CreneauPlanning, CreneauPlanningCreate, CreneauPlanningUpdate,
    SemaineType, SemaineTypeCreate,
    DemandeJourTravail, DemandeJourTravailCreate, DemandeMensuelleCreate,
    ApprobationJourTravailRequest, DemandeAnnulationRequest, AnnulationDirecteRequest,
    AssignationAssistant, NotePlanningJour, NotePlanningJourCreate
)
from models.conges import DemandeConge, DemandeCongeCreate, ApprobationRequest
from models.salle import Salle, SalleCreate, SalleUpdate, SalleReservation, ConfigurationCabinet, ConfigurationCabinetUpdate
from models.message import GroupeChat, GroupeChatCreate, Message, MessageCreate
from models.notification import NotificationSubscription, NotificationRequest, NotificationQuotidienne, NotificationTestRequest, QuickReplyRequest
from models.stock import CategorieStock, CategorieStockCreate, ArticleStock, ArticleStockCreate, ArticleStockUpdate, PermissionStock, PermissionStockCreate
from models.document import DocumentPersonnel, DocumentPersonnelCreate, Actualite, ActualiteCreate, ActualiteUpdate, PermissionDocument, PermissionDocumentCreate, QuotaEmploye, QuotaEmployeCreate, NoteGenerale
