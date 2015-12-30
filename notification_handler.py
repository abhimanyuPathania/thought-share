
import json
import time
import logging

from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.api import taskqueue
from google.appengine.datastore.datastore_query import Cursor

from utility_handler import Handler
from models import PrivateRequest
from helper_operations import *

from constants import NOTF_NAMESPACE
from constants import MAX_NOTIFICATIONS_FETCHED


#!!!!!!---------------make the admin only
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
	# /ajax/get-request-notifications

	def get(self):
		if not self.account:
			return self.fail_ajax()

		#user_key of the user logged-in in the app fetching notifications if any
		user = self.user_key.get()
		cursor_str = self.request.get('cursor_str')
		initial_fetch = self.request.get('initial_fetch')

		if initial_fetch:
			requests_result = {
				'request_list': None,
				'timestamp_list': None,
			}
		else:
			requests_result = {
				'request_list': None,
				'cursor_str': None,
				'more': None
			}

		# requesting user is not admin of any group, so there connot be any requests
		if not user.admin_groups:
			return self.render_json(requests_result)

		cursor = None
		if cursor_str:
			cursor = Cursor(urlsafe = cursor_str)

		# (results, timestamp_list) if intial fetch
		# (results, cursor, more) in not initial fetch
		requests_tuple = PrivateRequest.fetch_requests(user.admin_groups,
													   cursor, initial_fetch=initial_fetch)

		# both tuples return list of requests as first item
		if not requests_tuple[0]:
			return self.render_json(requests_result)

		if initial_fetch:
			requests_result['request_list'] = requests_tuple[0]
			requests_result['timestamp_list'] = requests_tuple[1]
		else:
			requests_result['request_list'] = requests_tuple[0]
			requests_result['cursor_str'] = (requests_tuple[1].urlsafe() if requests_tuple[1] else None)
			requests_result['more'] = requests_tuple[2]

		ntf_list = []
		user_key_list = []
		for req in requests_result['request_list']:
			ntf_list.append(req.to_dict(exclude = ["group_key","user_key"]))
			user_key_list.append(req.user_key)

		requests_result['request_list'] = add_user_name_image(ntf_list, user_key_list,
									   						  name_property = "user_name",
									   						  image_property = "user_image")

		return self.render_json(requests_result)

class UpdateRequestHandler(Handler):
	# /ajax/update-request-notifications

	def get(self):
		if not self.account:
			return self.fail_ajax()

		user = self.user_key.get()
		if not user.admin_groups:
			return self.render_json(None)

		timestamp = int(self.request.get('timestamp'))
		fetch = self.request.get('fetch')

		result = PrivateRequest.get_updates(user.admin_groups, timestamp, fetch)
		if not fetch:
			# only asking for number
			if not result:
				#no update
				return self.render_json({'number': 0, 'timestamp':None})
			else:
				# add the latest timestamp to track the number of requests
				# it will be sent during next poll

				# since result is ordered list of keys
				latest_timestamp = result[0].get().timestamp
				return self.render_json({'number': len(result),
										 'timestamp': latest_timestamp})
		else:
			#require to send back data
			request_dict = {'request_list': None}
			if not result:
				return self.render_json(request_dict)

			ntf_list = []
			user_key_list = []
			for req in result:
				ntf_list.append(req.to_dict(exclude = ["group_key","user_key"]))
				user_key_list.append(req.user_key)

			request_dict['request_list'] = add_user_name_image(ntf_list, user_key_list,
										   						  name_property = "user_name",
										   						  image_property = "user_image")
			return self.render_json(request_dict)

class CompleteRequestHandler(Handler):
	# /ajax/complete-request

	def post(self):
		if not self.account:
			return self.redirect('/')

		request_hash = self.request.get("request_hash");
		admin_id = self.user.user_id()

		# This query is placed out of the transactional PrivateRequest.complete_request 
		# since only ancestor queries are allowed inside
		req = PrivateRequest.query(PrivateRequest.request_hash == request_hash).get()
		if not req or (req and req.complete):
			#time.sleep(5)
			return self.fail_ajax();

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


class GetPostNotificationsHandler(Handler):
	# /ajax/get-post-notifications
	
	def get(self):
		if not self.account:
			return None

		# timestamp is sent 0; if client has not prior notifications in model
		timestamp = int(self.request.get('timestamp'))
		notifications = get_post_notifications(self.user_id, timestamp)
		return self.render_json(notifications)

class CheckPostNotificationHandler(Handler):
	# /ajax/check-post-notifications

	def get(self):
		if not self.account:
			return None

		result = {
			'exist':None,
			'number':0
		}
		num = 0
		notifications = memcache.get(self.user_id, namespace = NOTF_NAMESPACE)
		if not notifications:
			# user has no read/unread notifications
			return self.render_json(result)

		for n in notifications:
			if not n['read']:
				num += 1

		result['exist'] = True
		result['number'] = num

		return self.render_json(result)
