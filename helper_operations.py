
import time

from google.appengine.ext import ndb
from google.appengine.api import memcache

NOTF_NAMESPACE = 'notifications'

def add_user_name_image(target_list, users_key_list,
						name_property = "poster_name",
						image_property = "poster_image"):
	
	users = ndb.get_multi(users_key_list)
	for i in range(len(target_list)):
		target_list[i][name_property] = (users[i].display_name or users[i].email)
		target_list[i][image_property] = users[i].thumbnail_url
	return target_list


def create_notification_dict(group_name, group_id, ntf_type, poster_key, post_key = None):	
	## current notification model info ##
	# type --- post
	# post_id -> the posted GroupPost by user
	# poster_key, poster_name, poster_image -> user who posted in group
	
	# type --- join
	# post_id -> ''
	# poster_key, poster_name, poster_image -> admin who accepted request

	# type --- admin
	# post_id -> ''
	# poster_key, poster_name, poster_image -> admin who accepted request
	notification = {'poster_key': poster_key.urlsafe(),
					'group_name': group_name,
					'group_id': group_id,
					'type': ntf_type,
					'timestamp': str((int(time.time()))),
					'read': 'False'}

	if ntf_type == 'post' and post_key:
		notification['post_id'] = post_key.urlsafe()

	#put blank post_id
	if ntf_type == 'join' or ntf_type == 'admin':
		notification['post_id'] = ''

		#since this notification won't go through task queue worker
		#restore required types from string
		notification['timestamp'] = int(notification['timestamp'])
		notification['read'] = False

	return notification

def set_notification(notification, user_id):
	existing_notifications = memcache.get(user_id, namespace = NOTF_NAMESPACE)		
	#first instance case here

	#just create new memcache notification list consisting of
	#present notification only
	if not existing_notifications:
		memcache.set(user_id, [notification] ,namespace = NOTF_NAMESPACE)
	else:
		existing_notifications.append(notification)
		memcache.set(user_id, existing_notifications, namespace = NOTF_NAMESPACE)