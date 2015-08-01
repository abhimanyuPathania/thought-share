
# this cannot import from models, since it creates a circular import
# due to models importing add_to_index(only this one)

import time
import logging

from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.api import search
from google.appengine.ext import blobstore
from google.appengine.api import images

from helper_functions import build_suggestions 
from helper_functions import process_query_string
from helper_functions import limit_notifications

from constants import NOTF_NAMESPACE, USERS_NAMESPACE
from constants import DEFAULT_USER_AVATAR, DFAULT_GROUP_IMAGE


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
		target_list[i][image_property] = users[i].thumbnail_url or DEFAULT_USER_AVATAR
	return target_list

def get_group_data(group_key_list, params):
	# called in FeedHandler

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


def get_post_notifications(user_id, timestamp, history=None):

	notifications = memcache.get(user_id, namespace = NOTF_NAMESPACE)		
	if not notifications:
		return None

	unread_ntf = []
	unread_keys = []

	#fetch all for zero timestamp
	#this runs the first time when user fetches notifications on app refresh
	if timestamp == 0:
		for n in reversed(notifications):
			n['read'] = True
			unread_ntf.append(n)
			unread_keys.append(ndb.Key(urlsafe=n['poster_key']))

	if timestamp > 0:
		for n in reversed(notifications):
			#only choose the new notifications
			if not history:
				if n['timestamp'] > timestamp:
					n['read'] = True
					unread_ntf.append(n)
					unread_keys.append(ndb.Key(urlsafe=n['poster_key']))
			else:
				if n['timestamp'] < timestamp:
					n['read'] = True
					unread_ntf.append(n)
					unread_keys.append(ndb.Key(urlsafe=n['poster_key']))
	
	memcache.set(user_id, notifications, namespace = NOTF_NAMESPACE)
	
	# limit the number to 'MAX_NOTIFICATIONS_FETCHED'
	unread_ntf, unread_keys = limit_notifications(unread_ntf, unread_keys)

	#add updated user names and images to notifications
	if len(unread_ntf) > 0:
		unread_ntf = add_user_name_image(unread_ntf, unread_keys)
	return unread_ntf


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

	group_url_prefix = '/group/'
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
		temp["image"] = fields[1].value or DFAULT_GROUP_IMAGE
		temp["url"] = group_url_prefix + doc.doc_id
		results.append(temp)

	return results

def delete_image(image_type, user_key, group_key):
	user = user_key.get()

	if image_type == 'user':
		blob_key = user.image_blob
		if blob_key:

			# delete the the blob key, serving urls from datastore
			user.image_blob = None
			user.image_url = None
			user.thumbnail_url = None

			# stor serving the image and delete the orphan blob
			images.delete_serving_url(blob_key)
			blobstore.delete([blob_key])

			user.put()
			return True
		else:
			# user tried to delete non existing image
			return False

	if image_type == 'group':
		group = group_key.get()

		# check if user is allowed to edit the group
		allowed = False
		if group.private:
			# only admins are allowed to edit private groups
			allowed = user_key in group.admins
		else:
			# only creator is allowed to edit the public group
			allowed = user_key == group.creator

		if not allowed:
			return False

		cover_image_blob_key = group.cover_image_blob_key
		if cover_image_blob_key:
			#remove cover image fields if image uploaded
			group.cover_image_blob_key = None
			group.cover_image_url = None
			group.cover_image_thumbnail = None

			# stop serving the image and delete the orphan blob
			images.delete_serving_url(cover_image_blob_key)
			blobstore.delete([cover_image_blob_key])

			group.put()

			# update the search index document
			# we don't pass the group image which set to None by default
			add_to_index(group_key.id(), group.name)
			return True

		else:
			# user tried to delete non existing image
			return False




