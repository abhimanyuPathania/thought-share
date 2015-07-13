
from google.appengine.api import memcache
from google.appengine.api import taskqueue

from utility_handler import Handler
from models import PrivateRequest

NOTF_NAMESPACE = 'notifications'

class NotificationWorkerHandler(Handler):
	def get(self):
		self.redirect('/feed')

	def post(self):

		notification = {
			'post_id': self.request.get('post_id'),
			'poster_name': self.request.get('poster_name'),
			'poster_image': self.request.get('poster_image'),
			'group_name': self.request.get('group_name'),
			'group_id': self.request.get('group_id'),
			'group_image': self.request.get('group_image'),
			'timestamp': self.request.get('timestamp'),
			'read': self.request.get('read') == 'True',
		}
		user_id = self.request.get('user_id')

		existing_notifications = memcache.get(user_id, namespace = NOTF_NAMESPACE)		
		#first instance case here

		#just create new memcache notification list consisting of
		#present notification only
		if not existing_notifications:
			memcache.set(user_id, [notification], namespace = NOTF_NAMESPACE)
		else:
			existing_notifications.append(notification)
			memcache.set(user_id, existing_notifications, namespace = NOTF_NAMESPACE)
		
def create_notifications(user_key_list, worker_params):
	user_id_list = [user_key.id() for user_key in user_key_list]

	for user_id in user_id_list:
		worker_params['user_id'] = user_id
		taskqueue.add(url='/generate-notifications/posts', params = worker_params)

class RequestNotificationHandler(Handler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		notifications = PrivateRequest.fetch_notifications(self.user_key)
		if not notifications:
			return self.render_json(None)

		ntf_list = []
		for n in notifications:
			ntf_list.append(n.to_dict(exclude = ["group_key", "group_admins", "user_key"]))

		return self.render_json(ntf_list)

class CompleteRequestAjax(Handler):
	
	def post(self):
		if not self.user:
			return self.redirect('/')

		request_hash = self.request.get("request_hash");
		admin_id = self.user.user_id()
		complete = PrivateRequest.complete_request(admin_id, request_hash)
		if complete:
			return self.render_json(True);
		else:
			#return the ajax function in this case
			return self.render_json(None);

class GetPostNotificationsAjax(Handler):
	def get(self):
		if not self.user:
			return None

		notifications = memcache.get(self.user_id, namespace = NOTF_NAMESPACE)		
		if not notifications:
			return self.render_json(None)

		notifications.reverse()
		return self.render_json(notifications)


class UpdatePostNotificationsStatus(Handler):
	#since this request causes persistent changes, use a post
	def post(self):
		if not self.user:
			return None

		timestamp = int(self.request.get("timestamp"))
		notifications = memcache.get(self.user_id, namespace = NOTF_NAMESPACE)
		if not notifications:
			return None

		#if the timestamp sent by client is newer(greater) than that of notification
		#mark it as read
		for n in notifications:
			if timestamp >= int(n["timestamp"]):
				n["read"] = True

		memcache.set(self.user_id, notifications, namespace = NOTF_NAMESPACE)
		return self.render_json(True);




###Old Alogorithms...can be user to model hard notifications

# def create_notifications(user_key_list, notification):
# 	user_id_list = [user_key.id() for user_key in user_key_list]
# 	#namespace = 'notifications'
# 	memcache_dump = {}
# 	for user_id in user_id_list:
# 		existing_notifications = memcache.get(user_id, namespace = 'notifications')
# 		if not existing_notifications:
# 			memcache_dump[user_id] = [notification]
# 		else:
# 			existing_notifications.append(notification)
# 			memcache_dump[user_id] = existing_notifications
# 	memcache.set_multi(memcache_dump, namespace = 'notifications')

# def create_notifications(user_key_list, notification_content):
# 	user_id_list = [user_key.id() for user_key in user_key_list]

# 	for user_id in user_id_list:
# 		notification_key = 'notifications|' + user_id
# 		notification_flag = 'notif-flag|' + user_id

# 		notifications = memcache.get(notification_key)
# 		if not notifications:
# 			memcache.set(notification_key, notification_content)
# 			memcache.set(notification_flag, 'False')

# 		else:
# 			notification_read = memcache.get(notification_flag)
# 			if notification_read == 'False':
# 				notifications = notifications + '+' + notification_content
# 				memcache.set(notification_key, notifications)
# 				memcache.set(notification_flag, 'False')
# 			else:
# 				notifications = notifications + '|' + notification_content
# 				memcache.set(notification_key, notifications)
# 				memcache.set(notification_flag, 'False')

# def get_notifications(user_id):
# 	notification_key = 'notifications|' + user_id
# 	notification_flag = 'notif-flag|' + user_id

# 	notifications = memcache.get(notification_key)
# 	if not notifications:
# 		return None
# 	else:
# 		notification_read = memcache.get(notification_flag)
# 		if notification_read == 'False':
# 			#set the notification_flag to True
# 			memcache.set(notification_flag, 'True')

# 			#return latest unread notifications
# 			return notifications.split('|').pop().split('+')
# 		else:
# 			return ['No NEW notifications']


