
import time
import logging
import hashlib

from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.api import images
from google.appengine.ext import blobstore

from helper_functions import *
from helper_operations import add_to_index

from constants import USERS_NAMESPACE
from constants import MAX_POSTS_FETCHED, MAX_NOTIFICATIONS_FETCHED
from constants import GROUP_DESCRIPTION_CHAR_LIMIT

class User(ndb.Model):
	email = ndb.StringProperty(required = True, indexed = False)
	display_name = ndb.StringProperty(required = True, indexed = False)

	#change default value for basic avatars
	image_blob = ndb.BlobKeyProperty (indexed = False)
	image_url = ndb.StringProperty(indexed = False, default = None)
	admin_groups = ndb.KeyProperty(repeated = True, indexed = False)
	groups = ndb.KeyProperty(repeated = True, indexed = False)

	@classmethod
	def create_user(cls, user_id, display_name, email, blob):

		display_name = check_display_name(display_name)
		
		image_blob_key = None
		if blob:
			check_uploaded_image(blob)

			# means no bad image exception raised
			image_blob_key = blob.key()

		new_user = User(id = user_id,
						display_name = display_name,
						email = email)

		# set image if uploaded
		if image_blob_key:
			#set new image properties
			new_user.image_blob = image_blob_key
			new_user.image_url = images.get_serving_url(image_blob_key)

		# set the memcache and create account
		memcache.set(user_id, True, namespace = USERS_NAMESPACE)
		new_user.put()

	@classmethod
	def edit_user(cls, user_id, display_name, blob):

		#check and sanitize display name
		if display_name:
			display_name = check_display_name(display_name)

		image_blob_key = None
		if blob:
			check_uploaded_image(blob)
			image_blob_key = blob.key()

        #fetch user entity
		user = User.get_by_id(user_id)

		#update and save user according to the fields entered
		if display_name:
			user.display_name = display_name

		if image_blob_key:
			#delete the old blob and serving url if there
			if user.image_blob:
				images.delete_serving_url(user.image_blob)
				blobstore.delete([user.image_blob])

			#set new image properties
			user.image_blob = image_blob_key
			user.image_url = images.get_serving_url(image_blob_key)

		user.put()
		return True

class PrivateRequest(ndb.Model):
	#group info
	group_key = ndb.KeyProperty(required = True, indexed = True)
	group_name = ndb.StringProperty(required = True, indexed = False)

	#user info
	user_key = ndb.KeyProperty(required = True, indexed = True)

	#request info
	request_hash = ndb.StringProperty(required = True, indexed = True)
	complete = ndb.BooleanProperty(default = False, indexed = True)
	request_type = ndb.StringProperty(required = True, indexed = True)
	timestamp = ndb.IntegerProperty(required = True, indexed = True)

	@classmethod
	def raise_request(cls, group, user, request_type):
		request_id = PrivateRequest.allocate_ids(size = 1)[0]
		id_hash = hashlib.md5(str(request_id)).hexdigest()
		new_request = PrivateRequest(id = request_id,
										group_key = group.key,
										group_name = group.name,
										user_key = user.key,
										request_hash = id_hash,
										request_type = request_type,
										timestamp = int(time.time()))
		new_request.put()
		return True

	#put this in a transaction
	@classmethod
	@ndb.transactional(xg=True)
	def complete_request(cls, admin_id, req):
		admin_key = ndb.Key(User, admin_id)
		target_user_and_group = ndb.get_multi([req.user_key, req.group_key])
		target_user = target_user_and_group[0]
		target_group = target_user_and_group[1]

		#only go further if user(logged-in; fulfilling the req) is a group admin
		if admin_key in target_group.admins:

			if req.request_type == 'join':
				#add group key to User groups
				if req.group_key not in target_user.groups:
					target_user.groups.append(req.group_key)

				#add user key to Group members
				if req.user_key not in target_group.members:
					target_group.members.append(req.user_key)

				#set the complete flag on request
				req.complete = True

				ndb.put_multi([target_user, target_group, req])
				return target_group

			if req.request_type == 'admin':
				#again checking if target_user is a member and not an admin already
				if req.user_key in target_group.members and req.user_key not in target_group.admins:
					
					#add user_key to group admins list
					if req.user_key not in target_group.admins:
						target_group.admins.append(req.user_key)

					#add group key to user's admin groups list
					if req.group_key not in target_user.admin_groups:
						target_user.admin_groups.append(req.group_key)

					#update the request's complete flag
					req.complete = True

					ndb.put_multi([target_group, req, target_user])
					return target_group

		#return false otherwise 
		return False

	@classmethod
	def fetch_requests(cls, user_admin_groups, cursor, initial_fetch = False):
		
		q = PrivateRequest.query(ndb.AND(PrivateRequest.complete == False,
										 PrivateRequest.group_key.IN(user_admin_groups)))

		q = q.order(-PrivateRequest.timestamp)
		# this is to return correct number for intial request fetch in the component
		# required since the the number of unread requests can be greater than our page
		# size. But we still return only page size number of results

		if initial_fetch:
			# projection returns timestamps as well keys
			projection = q.fetch( projection = [PrivateRequest.timestamp])
			request_data = None
			request_timestamps = None

			if len(projection) > 0:
				request_keys = []
				request_timestamps = []
				# extract entity key and timestamps
				for p in projection:
					request_keys.append(p.key)
					request_timestamps.append(p.timestamp)
				
				# slice does not cause error if size of list is smaller
				# this gives at-most 'MAX_NOTIFICATIONS_FETCHED'
				request_data = ndb.get_multi(request_keys[:MAX_NOTIFICATIONS_FETCHED])

			request_tuple = (request_data, request_timestamps)
		else:
			# this case is for the view profile page
			request_tuple = q.fetch_page(MAX_NOTIFICATIONS_FETCHED, start_cursor = cursor)

		return request_tuple

	@classmethod
	def get_updates(cls, user_admin_groups, timestamp, fetch):
		q = PrivateRequest.query(ndb.AND(PrivateRequest.complete == False,
										 PrivateRequest.group_key.IN(user_admin_groups)),
										 PrivateRequest.timestamp > timestamp)
		
		q = q.order(-PrivateRequest.timestamp)

		if not fetch:
			# only fetch keys since we only require the number of results
			keys = q.fetch(keys_only = True)
			return keys
		else:
			# don't fetch more than the max limit
			return q.fetch(limit = MAX_NOTIFICATIONS_FETCHED)


	@classmethod
	def test_existing_request(cls, user_key, group_key, request_type):
		q = PrivateRequest.query(ndb.AND(PrivateRequest.user_key == user_key,
										 PrivateRequest.group_key == group_key,
										 PrivateRequest.complete == False,
										 PrivateRequest.request_type == request_type))
		req = q.get()
		return req

class Group(ndb.Model):
	#make sure let the name remain fixed upon setting it once
	name = ndb.StringProperty(required = True)
	description = ndb.TextProperty(required = True, indexed = False)
	private = ndb.BooleanProperty(default = False)
	cover_image_blob_key = ndb.BlobKeyProperty (indexed = False)
	cover_image_url = ndb.StringProperty(indexed = False)
	created = ndb.DateProperty(auto_now_add = True, indexed = False)

	creator = ndb.KeyProperty(kind = User)
	admins = ndb.KeyProperty (kind = User, repeated = True)
	members = ndb.KeyProperty (kind = User, repeated = True)
	members_number = ndb.ComputedProperty(lambda self: len(self.members))

	@classmethod
	def create_group(cls, name, description, creator, private, cover_image_blob):
		
		#first test for group name regular expression
		#raises BadUserInputError on faliure
		name_test = check_group_name(name)

		#check if description is blank
		if not description or description.isspace():
			raise BadUserInputError('please enter group description')

		if len(description) > GROUP_DESCRIPTION_CHAR_LIMIT:
			raise BadUserInputError('group description exceeds limit')

		#get sanitized group name/id
		group_name = sanitize_group_name(name)
		group_id = get_group_id(group_name)

		#test for availability of group name
		availability_test = Group.get_by_id(group_id)

		if availability_test:
			raise EntityExistsError('Group name taken')

		#test for uploaded blob
		cover_image_blob_key = None
		if cover_image_blob:
			check_uploaded_image(cover_image_blob)
			cover_image_blob_key = cover_image_blob.key()

		creator_user = creator.get()
		new_group_key = ndb.Key(Group, group_id)
		if name_test and not availability_test:
			#cosmetic if statement
			new_group = Group(id = group_id,
								name = group_name,
								description = description,
								creator = creator,
								members = [creator])
			if private:
				new_group.private = True
				new_group.admins = [creator]
				if new_group_key not in creator_user.admin_groups:
					creator_user.admin_groups.append(new_group_key)

			if cover_image_blob_key:
				#add cover image fields if image uploaded
				new_group.cover_image_blob_key = cover_image_blob_key
				new_group.cover_image_url = images.get_serving_url(cover_image_blob_key)
			
			if new_group_key not in creator_user.groups:
				creator_user.groups.append(new_group_key)

			#!!!!!!!!!!!!!!!!!!!both the below fields can cause exceptions
			ndb.put_multi([creator_user, new_group])
			add_to_index(group_id, group_name, description, new_group.cover_image_url)

			return new_group_key

	@classmethod
	def join_group(cls, user_key, group_key):
		user_and_group = ndb.get_multi([user_key, group_key])
		user = user_and_group[0]
		group = user_and_group[1]

		if group_key in user.groups:
			return False
		
		if group.private:
			#check for already existing request
			test = PrivateRequest.test_existing_request(user_key, group_key, 'join')
			if test:
				return False

			PrivateRequest.raise_request(group, user, 'join')
			return True
		else:
			#add group key to User's groups list
			if group_key not in user.groups:
				user.groups.append(group_key)

			#add user key to Group members
			if user_key not in group.members:
				group.members.append(user_key)

			ndb.put_multi([user, group])
			return True

	@classmethod
	def edit_group(cls, user_key, group_id, description, blob):

		group = Group.get_by_id(group_id)

		allowed = False
		if group.private:
			# only admins are allowed to edit private groups
			allowed = user_key in group.admins
		else:
			# only creator is allowed to edit the public group
			allowed = user_key == group.creator
		if not allowed:
			return None

		# extra check for most probable mistake post
		if not blob and description == group.description:
			return None

		if description and not description.isspace() and len(description) <= GROUP_DESCRIPTION_CHAR_LIMIT:
			group.description = description

		blob_key = None
		if blob:
			check_uploaded_image(blob)
			blob_key = blob.key()

		if blob_key:
			#delete old image if there
			if group.cover_image_blob_key:

				#stop serving the blob via image service
				images.delete_serving_url(group.cover_image_blob_key)

				#delete the blob from blobstore
				blobstore.delete([group.cover_image_blob_key])

			#update to newly uploaded
			group.cover_image_blob_key = blob_key
			group.cover_image_url = images.get_serving_url(blob_key)

		group.put()
		#update the search index document to contain latest image url or description
		add_to_index(group_id, group.name, group.description, group.cover_image_url)
		return True


	@classmethod
	def leave_group(cls, user_key, group_key):
		user_and_group = ndb.get_multi([user_key, group_key])
		user = user_and_group[0]
		group = user_and_group[1]

		if group_key not in user.groups:
			return False

		# delete_item removes duplicates in case they exist
		user.groups = delete_item(user.groups, group_key)
		group.members = delete_item(group.members, user_key)

		if group.private:
			# check/del for existing admin request by the user in leaving group
			req_key = PrivateRequest.test_existing_request(user_key, group_key, 'admin')
			if req_key:
				req_key.delete()
			
			# if leaving user is also an admin
			if user_key in group.admins:
				# remove user from admin list
				group.admins = delete_item(group.admins, user_key)

				# remove group from user's admin_groups
				user.admin_groups = delete_item(user.admin_groups, group_key)

		ndb.put_multi([user, group])
		return True

class GroupPost(ndb.Model):
	group_id = ndb.StringProperty(required = True, indexed = True)
	group_name = ndb.StringProperty(required = True, indexed = False)
	user_id = ndb.StringProperty(required = True, indexed = True)
	post = ndb.TextProperty(required = True, indexed = False)
	created = ndb.IntegerProperty(required = True, indexed = True)

	@classmethod
	def create_group_post(cls, group_id, group_name, user_id, post):
		group_post_id = GroupPost.allocate_ids(size=1)[0]

		# isspace checks if post only has spaces, newlines or tabs
		if not post or post.isspace():
			raise BadUserInputError('post content cannot be blank')

		#call strip on post to remove extra white space on start/end
		group_post = GroupPost(id = group_post_id,
								group_id = group_id,
								group_name = group_name,
								user_id = user_id,
								post = post.strip(),
								created = int(time.time()))
		#create a post_data to be returned to the viewmodel
		#poster information is added from the user model in client itself
		post_data = group_post.to_dict()
		post_data["post_id"] = group_post.key.urlsafe()

		group_post_key = group_post.put()
		return group_post_key, post_data

	@classmethod
	def fetch_posts(cls, group_id, user_id, cursor):
		#cursor is the Cursor object
		q = GroupPost.query()
		
		# only get the posts with the given parameter
		if group_id:
			q = q.filter(GroupPost.group_id == group_id)

		if user_id:
			q = q.filter(GroupPost.user_id == user_id)

		q = q.order(-GroupPost.created)
		
		# start_cursor has a default value of None
		fetch_page_tuple = q.fetch_page(MAX_POSTS_FETCHED, start_cursor = cursor)
		return fetch_page_tuple


	@classmethod
	def fetch_post_updates(cls, group_id, timestamp):
		q = GroupPost.query()
		
		# only get the posts with the given group id
		q = q.filter(GroupPost.group_id == group_id)
		# fetch posts later than provided timestamp
		q = q.filter(GroupPost.created > timestamp)
		q = q.order(-GroupPost.created)

		return q.fetch()
