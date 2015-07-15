
import json
import logging

from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.api import taskqueue

from utility_handler import Handler
from models import PrivateRequest
from helper_operations import *

NOTF_NAMESPACE = 'notifications'

class NotificationWorkerHandler(Handler):
	def get(self):
		self.redirect('/feed')

	def post(self):
		#reconstruct notification from the post params
		notification = {
			'post_id': self.request.get('post_id'),
			'poster_key': self.request.get('poster_key'),
			'group_name': self.request.get('group_name'),
			'group_id': self.request.get('group_id'),
			'type': self.request.get('type'),
			'timestamp': int(self.request.get('timestamp')),
			'read': self.request.get('read') == 'True',
		}

		#set notification
		user_id = self.request.get('user_id')
		set_notification(notification, user_id)
		
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
		user_key_list = []
		for n in notifications:
			ntf_list.append(n.to_dict(exclude = ["group_key","user_key"]))
			user_key_list.append(n.user_key)

		users = ndb.get_multi(user_key_list)
		for i in range(len(ntf_list)):
			ntf_list[i]["user_name"] = (users[i].display_name or users[i].email)
			ntf_list[i]["user_image"] = users[i].thumbnail_url
		return self.render_json(ntf_list)

class CompleteRequestAjax(Handler):
	
	def post(self):
		if not self.user:
			return self.redirect('/')

		request_hash = self.request.get("request_hash");
		admin_id = self.user.user_id()

		# This query is placed out of the transactional PrivateRequest.complete_request 
		# since only projection queries are allowed inside
		req = PrivateRequest.query(PrivateRequest.request_hash == request_hash).get()
		if not req:
			return self.render_json(None);

		# get back target group entity to set notification
		target_group = PrivateRequest.complete_request(admin_id, req)
		if not target_group:
			#return the ajax function in this case
			return self.render_json(None);

		data = {'poster_key': self.user_key,
				'group_name': target_group.name,
				'group_id': target_group.key.id(),
				'ntf_type': req.request_type}
		notification = create_notification_dict(**data)
		set_notification(notification, req.user_key.id())
		return self.render_json(True);


class GetPostNotificationsAjax(Handler):
	def get(self):
		if not self.user:
			return None

		# timestamp is sent 0; if client has not prior notifications in model
		timestamp = int(self.request.get('timestamp'))
		notifications = memcache.get(self.user_id, namespace = NOTF_NAMESPACE)		
		if not notifications:
			return self.render_json(None)

		#the notifications added to unread_ntf will be viewed by user
		#hence we have to set the 'read' to True beforehand (problamatic if req fails)
		unread_ntf = []
		unread_keys = []

		#fetch all for zero timestamp
		#this runs the first time when user fetches notifications on app refresh
		if timestamp == 0:
			for n in reversed(notifications):
				n['read'] = True
				unread_ntf.append(n)
				unread_keys.append(ndb.Key(urlsafe=n['poster_key']))
		
		# sent timestamp will be always <= any new notification since we always send
		# a '0' timestamp at first run of app no matter what and this 'url'
		# in not called till we have new notifications
		if timestamp > 0:
			for n in reversed(notifications):
				#only choose the new notifications
				if n['timestamp'] > timestamp:
					n['read'] = True
					unread_ntf.append(n)
					unread_keys.append(ndb.Key(urlsafe=n['poster_key']))

		#update memcache
		memcache.set(self.user_id, notifications, namespace = NOTF_NAMESPACE)

		#add updated user names and images to notifications
		unread_ntf = add_user_name_image(unread_ntf, unread_keys)
		return self.render_json(unread_ntf)

class CheckPostNotificationfAjax(Handler):
	def get(self):
		if not self.user:
			return None

		num = 0
		notifications = memcache.get(self.user_id, namespace = NOTF_NAMESPACE)
		if not notifications:
			return self.render_json(num)

		for n in notifications:
			if not n['read']:
				num += 1

		return self.render_json(num)



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


