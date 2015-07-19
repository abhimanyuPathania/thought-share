
# this cannot import from models, since it creates a circular import
# due to models importing add_to_index(only this one)

import time
import logging

from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.api import search

from helper_functions import build_suggestions 
from helper_functions import process_query_string

NOTF_NAMESPACE = 'notifications'
USERS_NAMESPACE = 'users'

def check_user_warm_cache(user_key):
	user_id = user_key.id()
	memcache_test = memcache.get(user_id, namespace = USERS_NAMESPACE)
	# if user in cache, means account exists
	if memcache_test:
		return True
	else:
		user = user_key.get()
		# not in memcache, but user exists -> put user in cache again
		if user:
			memcache.set(user_id, True, namespace = USERS_NAMESPACE)
			return True
		# user account needs to be created
		else:
			return False

def add_user_name_image(target_list, users_key_list,
						name_property = "poster_name",
						image_property = "poster_image"):
	
	users = ndb.get_multi(users_key_list)
	for i in range(len(target_list)):
		target_list[i][name_property] = users[i].display_name
		target_list[i][image_property] = users[i].thumbnail_url
	return target_list

def get_group_data(group_key_list, params):
	groups = ndb.get_multi(group_key_list)
	group_data = []

	for g in groups:
		temp = g.to_dict(include = params)
		temp['id'] = g.key.id()
		group_data.append(temp)
	return group_data


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

#!!!!!!!!!handle put exception
def add_to_index(group_id, group_name, group_image = None):
	group_index = search.Index(name='groups')

	group_document = search.Document(
	    doc_id = group_id,
	    fields=[
		       	search.TextField(name='name', value=group_name),
		       	search.TextField(name='suggestions', value=build_suggestions(group_name)),
		       	search.AtomField(name='group_image', value=group_image),
	       ])
	group_index.put(group_document)
	
	# try:
 #  		group_index.put(group_document)
 #  	except search.Error:
 #  		logging.exception('Group document put failed')

def search_index(query_string):
	URL_PREFIX = '/group/'
	group_index = search.Index(name='groups')

	query_options = search.QueryOptions(
		limit = 12,
		returned_fields = ['name', 'group_image']
	)

	query_string = process_query_string(query_string)
	query = search.Query(query_string = query_string, options = query_options)
	documents =  group_index.search(query)
	if len(documents.results) == 0:
		return None
	
	results = []
	for doc in documents:
		temp = {}
		fields = doc.fields
		temp["name"] = fields[0].value
		temp["image"] = fields[1].value
		temp["url"] = URL_PREFIX + doc.doc_id
		results.append(temp)

	return results




