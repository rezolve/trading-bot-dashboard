"""
Firebase client for bot runtime.
Handles Firestore and Cloud Storage operations.
"""

import os
import logging
from datetime import datetime
from typing import Dict, Any, Optional
import firebase_admin
from firebase_admin import credentials, firestore, storage

logger = logging.getLogger(__name__)


class FirebaseClient:
    """Firebase client for bot operations."""
    
    def __init__(self, use_emulator: bool = False):
        """Initialize Firebase client.
        
        Args:
            use_emulator: Whether to use Firebase emulators (default: False)
        """
        self.use_emulator = use_emulator
        
        # Initialize Firebase Admin
        if not firebase_admin._apps:
            if use_emulator:
                # Use emulators
                os.environ['FIRESTORE_EMULATOR_HOST'] = 'localhost:8180'
                os.environ['FIREBASE_STORAGE_EMULATOR_HOST'] = 'localhost:9199'
                
                # Initialize with default credentials for emulator
                firebase_admin.initialize_app()
            else:
                # Production: use service account or default credentials
                firebase_admin.initialize_app()
        
        self.db = firestore.client()
        self.storage_bucket = storage.bucket()
        
        logger.info(f"Firebase client initialized (emulator={use_emulator})")
    
    def get_bot_config(self, bot_id: str) -> Optional[Dict[str, Any]]:
        """Get bot configuration from Firestore.
        
        Args:
            bot_id: Bot ID
            
        Returns:
            Bot configuration dict or None if not found
        """
        try:
            doc_ref = self.db.collection('bots').document(bot_id)
            doc = doc_ref.get()
            
            if doc.exists:
                return doc.to_dict()
            else:
                logger.warning(f"Bot {bot_id} not found")
                return None
        except Exception as e:
            logger.error(f"Error getting bot config: {e}")
            return None
    
    def update_bot_status(self, bot_id: str, status: str, **kwargs) -> bool:
        """Update bot status in Firestore.
        
        Args:
            bot_id: Bot ID
            status: New status
            **kwargs: Additional fields to update
            
        Returns:
            True if successful
        """
        try:
            doc_ref = self.db.collection('bots').document(bot_id)
            update_data = {
                'status': status,
                'updatedAt': firestore.SERVER_TIMESTAMP,
                **kwargs
            }
            doc_ref.update(update_data)
            logger.info(f"Bot {bot_id} status updated to {status}")
            return True
        except Exception as e:
            logger.error(f"Error updating bot status: {e}")
            return False
    
    def log_activity(self, bot_id: str, user_id: str, event_type: str, 
                     message: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Log activity event to Firestore.
        
        Args:
            bot_id: Bot ID
            user_id: User ID
            event_type: Event type
            message: Event message
            metadata: Optional metadata dict
            
        Returns:
            True if successful
        """
        try:
            doc_ref = self.db.collection('bot-activity').document()
            doc_ref.set({
                'botId': bot_id,
                'userId': user_id,
                'eventType': event_type,
                'message': message,
                'metadata': metadata or {},
                'createdAt': firestore.SERVER_TIMESTAMP,
            })
            logger.debug(f"Activity logged: {event_type} - {message}")
            return True
        except Exception as e:
            logger.error(f"Error logging activity: {e}")
            return False
    
    def save_position(self, bot_id: str, user_id: str, position: Dict[str, Any]) -> bool:
        """Save position to Firestore.
        
        Args:
            bot_id: Bot ID
            user_id: User ID
            position: Position data
            
        Returns:
            True if successful
        """
        try:
            position_id = f"{bot_id}_{position['symbol']}"
            doc_ref = self.db.collection('positions').document(position_id)
            
            doc_ref.set({
                **position,
                'botId': bot_id,
                'userId': user_id,
                'updatedAt': firestore.SERVER_TIMESTAMP,
            }, merge=True)
            
            logger.debug(f"Position saved: {position['symbol']}")
            return True
        except Exception as e:
            logger.error(f"Error saving position: {e}")
            return False
    
    def save_order(self, bot_id: str, user_id: str, order: Dict[str, Any]) -> bool:
        """Save order to Firestore.
        
        Args:
            bot_id: Bot ID
            user_id: User ID
            order: Order data
            
        Returns:
            True if successful
        """
        try:
            order_id = order.get('id', f"order_{datetime.now().timestamp()}")
            doc_ref = self.db.collection('orders').document(order_id)
            
            doc_ref.set({
                **order,
                'botId': bot_id,
                'userId': user_id,
                'updatedAt': firestore.SERVER_TIMESTAMP,
            }, merge=True)
            
            logger.debug(f"Order saved: {order_id}")
            return True
        except Exception as e:
            logger.error(f"Error saving order: {e}")
            return False
    
    def upload_backtest_artifact(self, user_id: str, bot_id: str, 
                                  backtest_id: str, filename: str, 
                                  data: bytes) -> Optional[str]:
        """Upload backtest artifact to Cloud Storage.
        
        Args:
            user_id: User ID
            bot_id: Bot ID
            backtest_id: Backtest ID
            filename: File name
            data: File data as bytes
            
        Returns:
            Public URL or None if failed
        """
        try:
            blob_path = f"{user_id}/{bot_id}/{backtest_id}/{filename}"
            blob = self.storage_bucket.blob(blob_path)
            blob.upload_from_string(data)
            
            # Make blob publicly readable (adjust based on security requirements)
            # blob.make_public()
            
            logger.info(f"Artifact uploaded: {blob_path}")
            return blob.public_url if blob.public_url else blob.path
        except Exception as e:
            logger.error(f"Error uploading artifact: {e}")
            return None
    
    def watch_bot_config(self, bot_id: str, callback):
        """Watch bot config for changes (real-time updates).
        
        Args:
            bot_id: Bot ID
            callback: Callback function(doc_snapshot, changes, read_time)
        """
        doc_ref = self.db.collection('bots').document(bot_id)
        doc_watch = doc_ref.on_snapshot(callback)
        return doc_watch
