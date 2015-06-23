
import time
import logging
import hashlib

from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.api import images
from google.appengine.ext import blobstore

from helper_functions import (check_group_name, sanitize_group_name, get_group_id,
							check_display_name)
from helper_functions import BadUserInputError, EntityExistsError

class User(ndb.Model):
	email = ndb.StringProperty(required = True, indexed = False)
	display_name = ndb.StringProperty(indexed = False)

	#change default value for basic avatars
	image_blob = ndb.BlobKeyProperty (indexed = False)
	image_url = ndb.StringProperty(indexed = False, default = None)
	thumbnail_url = ndb.StringProperty(indexed = False, default = None)
	groups = ndb.KeyProperty(repeated = True, indexed = False)

	@classmethod
	def create_user(cls, user_id, email):
		new_user = User(id = user_id,
						email = email)
		memcache.set(user_id, True, namespace = 'users')
		key = new_user.put()
		return key

	@classmethod
	def edit_user(cls, user_id, display_name, image_blob_key):

		#check and sanitize display name
		if display_name:
			display_name = check_display_name(display_name)
		full_image_url = None
		thumbnail_url = None

		if image_blob_key:
			#create image service urls
			full_image_url = images.get_serving_url(image_blob_key)
			thumbnail_url = images.get_serving_url(image_blob_key, size = 100, crop = False)

        #fetch user entity
		user = User.get_by_id(user_id)

		#update and save user according to the fields entered
		if display_name:
			user.display_name = display_name
		if image_blob_key:
			#delete the old blob
			blobstore.delete([user.image_blob])

			#set new properties
			user.image_blob = image_blob_key
			user.image_url = full_image_url
			user.thumbnail_url = thumbnail_url

		if display_name or image_blob_key:
			#put only if we are updating something
			user.put()
			return True

class PrivateRequest(ndb.Model):
	group_key = ndb.KeyProperty(required = True)
	group_admins = ndb.KeyProperty(repeated = True, indexed = True)
	user_key = ndb.KeyProperty(required = True)
	request_hash = ndb.StringProperty(required = True)
	complete = ndb.BooleanProperty(default = False)
	request_type = ndb.StringProperty(required = True, indexed = False)

	@classmethod
	def raise_request(cls, group, user, request_type):
		request_id = PrivateRequest.allocate_ids(size = 1)[0]
		id_hash = hashlib.md5(str(request_id)).hexdigest()
		new_request = PrivateRequest(id = request_id,
										group_key = group.key,
										group_admins = group.admins,
										user_key = user.key,
										request_hash = id_hash,
										request_type = request_type)
		new_request.put()
		return True

	@classmethod
	def complete_request(cls, admin_id, request_hash):
		req = PrivateRequest.query(PrivateRequest.request_hash == request_hash).get()

		if req:
			admin_key = ndb.Key(User, admin_id)
			if admin_key in req.group_admins:

				target_user = req.user_key.get()
				target_group = req.group_key.get()

				if req.request_type == 'join':
					#add group key to User groups
					target_user.groups.append(req.group_key)

					#add user key to Group members
					target_group.members.append(req.user_key)

					#set the complete flag on request
					req.complete = True

					target_user.put()
					target_group.put()
					req.put()
					return True

				if req.request_type == 'admin':
					if req.user_key in target_group.members and req.user_key not in target_group.admins:
						target_group.admins.append(req.user_key)
						req.complete = True

						target_group.put()
						req.put()
						return True
		
		#return false otherwise 
		return False

	@classmethod
	def fetch_notifications(cls, user_id):
		#user_id of the user logged in the app fetching notifications if any
		user_key = ndb.Key(User, user_id)
		notifications = PrivateRequest.query(PrivateRequest.group_admins == user_key, PrivateRequest.complete == False).fetch()
		return notifications


class Group(ndb.Model):
	name = ndb.StringProperty(required = True)
	description = ndb.TextProperty(required = True, indexed = False)
	private = ndb.BooleanProperty(default = False)
	cover_image_blob_key = ndb.BlobKeyProperty (indexed = False)
	cover_image_url = ndb.StringProperty(indexed = False)
	cover_image_thumbnail = ndb.StringProperty(indexed = False)
	created = ndb.DateProperty(auto_now_add = True, indexed = False)

	creator = ndb.KeyProperty(kind = User)
	admins = ndb.KeyProperty (kind = User, repeated = True)
	members = ndb.KeyProperty (kind = User, repeated = True)

	@classmethod
	def create_group(cls, name, description, creator, private, cover_image_blob_key):
		
		#first test for group name regular expression
		#raises BadUserInputError on faliure
		name_test = check_group_name(name)

		#check if description is blank
		if not description:
			raise BadUserInputError('please enter group description')

		#get sanitized group name/id
		group_name = sanitize_group_name(name)
		group_id = get_group_id(group_name)

		#test for availability of group name
		availability_test = Group.get_by_id(group_id)

		if availability_test:
			raise EntityExistsError('Group name taken')

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

			if cover_image_blob_key:
				#add cover image fields if image uploaded
				new_group.cover_image_blob_key = cover_image_blob_key
				new_group.cover_image_url = images.get_serving_url(cover_image_blob_key)
				new_group.cover_image_thumbnail = images.get_serving_url(cover_image_blob_key, size = 100)
			
			new_group_key = new_group.put()

			#also add the group key to the user's groups list
			#in the User entity
			user = creator.get()
			user.groups.append(new_group_key)
			user.put()

			return new_group_key

	@classmethod
	def join_group(cls, user_key, group_key):
		user = user_key.get()
		group = group_key.get()

		if group_key in user.groups:
			return False
		
		if group.private:
			PrivateRequest.raise_request(group, user, 'join')
		else:
			#add group key to User's groups list
			user.groups.append(group_key)

			#add user key to Group members
			group.members.append(user_key)

			user.put()
			group.put()
			return True

	@classmethod
	def leave_group(cls, user_key, group_key):
		user = user_key.get()
		group = group_key.get()

		if group_key not in user.groups:
			return False
		else:
			user.groups.remove(group_key)
			group.members.remove(user_key)
			user.put()
			group.put()
			return True

class GroupPost(ndb.Model):
	group_id = ndb.StringProperty(required = True, indexed = True)
	user_id = ndb.StringProperty(required = True, indexed = True)
	post = ndb.TextProperty(required = True, indexed = False)
	created = ndb.DateTimeProperty(auto_now = True)

	@classmethod
	def create_group_post(cls, group_id, user_id, post):
		group_post_id = group_id + "|" + user_id

		if not post:
			raise BadUserInputError('post content cannot be blank')

		group_post = GroupPost(id = group_post_id,
								group_id = group_id,
								user_id = user_id,
								post = post)

		group_post_key = group_post.put()
		return group_post_key

	@classmethod
	def fetch_posts_by_group(cls, group_id):
		group_posts = GroupPost.query(GroupPost.group_id == group_id).fetch()
		if group_posts:
			return group_posts
		else:
			return None

