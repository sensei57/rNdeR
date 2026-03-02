"""Modèles liés aux notifications"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


class NotificationSubscription(BaseModel):
    token: str
    device_name: Optional[str] = None
    browser: Optional[str] = None
    platform: Optional[str] = None
    device_id: Optional[str] = None


class NotificationRequest(BaseModel):
    user_id: str
    title: str
    body: str
    data: Optional[Dict] = None


class NotificationQuotidienne(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    message: str
    date_envoi: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class NotificationTestRequest(BaseModel):
    user_ids: List[str]
    title: str
    body: str


class QuickReplyRequest(BaseModel):
    message_id: str
    reply_content: str
    reply_to_user_id: Optional[str] = None
