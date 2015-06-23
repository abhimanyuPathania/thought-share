
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
			'poster_name': self.request.get('poster_name'),
			'group_name': self.request.get('group_name'),
			'timestamp': self.request.get('timestamp'),
			'read': self.request.get('read') == 'True',
		}
		user_id = self.request.get('user_id')

		existing_notifications = memcache.get(user_id, namespace = NOTF_NAMESPACE)
		if not existing_notifications:
			memcache.set(user_id, [notification], namespace = NOTF_NAMESPACE)
		else:
			existing_notifications.append(notification)
			memcache.set(user_id, existing_notifications, namespace = NOTF_NAMESPACE)

class RequestNotificationHandler(Handler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		user_id = self.user.user_id()
		notifications = PrivateRequest.fetch_notifications(user_id)
		return self.render('request_notifications.html', notifications = notifications)

class CompleteRequestHandler(Handler):
	
	def post(self, request_hash):
		if not self.user:
			return self.redirect('/')

		admin_id = self.user.user_id()
		complete = PrivateRequest.complete_request(admin_id, request_hash)
		if complete:
			return self.redirect('/feed')
		else:
			return self.render('datastore.html', result =  'something went wrong')




def create_notifications(user_key_list, worker_params):
	user_id_list = [user_key.id() for user_key in user_key_list]

	for user_id in user_id_list:
		worker_params['user_id'] = user_id
		taskqueue.add(url='/generate-notifications/posts', params = worker_params)



def get_notifications(user_id):
	notifications = memcache.get(user_id, namespace = NOTF_NAMESPACE)
	result = []
	if not notifications:
		return None
	else:
		for ntf in reversed(notifications):
			if ntf['read'] == False:
				result.append(ntf)
	
	if len(result) == 0:
		return None

	return result


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


