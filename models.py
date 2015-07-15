
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

	admin_groups = ndb.KeyProperty(repeated = True, indexed = False)
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
				target_user.groups.append(req.group_key)

				#add user key to Group members
				target_group.members.append(req.user_key)

				#set the complete flag on request
				req.complete = True

				ndb.put_multi([target_user, target_group, req])
				return target_group

			if req.request_type == 'admin':
				#again checking if target_user is a member and not an admin already
				if req.user_key in target_group.members and req.user_key not in target_group.admins:
					
					#add user_key to group admins list
					target_group.admins.append(req.user_key)

					#add group key to user's admin groups list
					target_user.admin_groups.append(req.group_key)

					#update the request's complete flag
					req.complete = True

					ndb.put_multi([target_group, req, target_user])
					return target_group

		#return false otherwise 
		return False

	@classmethod
	def fetch_notifications(cls, user_key):
		#user_key of the user logged-in in the app fetching notifications if any
		user = user_key.get()
		if not user.admin_groups:
			return None

		q = PrivateRequest.query(ndb.AND(PrivateRequest.complete == False,
										 PrivateRequest.group_key.IN(user.admin_groups)))
		
		notifications = q.order(-PrivateRequest.timestamp).fetch()
		return notifications

	@classmethod
	def test_existing_request(cls, user_key, group_key, request_type):
		q = PrivateRequest.query(ndb.AND(PrivateRequest.user_key == user_key,
										 PrivateRequest.group_key == group_key,
										 PrivateRequest.complete == False,
										 PrivateRequest.request_type == request_type))
		req = q.get(keys_only = True)
		return req

class Group(ndb.Model):
	#make sure let the name remain fixed upon setting it once
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
				creator_user.admin_groups.append(new_group_key)

			if cover_image_blob_key:
				#add cover image fields if image uploaded
				new_group.cover_image_blob_key = cover_image_blob_key
				new_group.cover_image_url = images.get_serving_url(cover_image_blob_key)
				new_group.cover_image_thumbnail = images.get_serving_url(cover_image_blob_key, size = 100)
			
			creator_user.groups.append(new_group_key)
			creator_user.put()

			new_group.put()
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
			user.groups.append(group_key)

			#add user key to Group members
			group.members.append(user_key)

			ndb.put_multi([user, group])
			return True

	@classmethod
	def leave_group(cls, user_key, group_key):
		user_and_group = ndb.get_multi([user_key, group_key])
		user = user_and_group[0]
		group = user_and_group[1]

		if group_key not in user.groups:
			return False
		else:
			user.groups.remove(group_key)
			group.members.remove(user_key)

			if group.private:
				# check/del for existing admin request by the user in leaving group
				req_key = PrivateRequest.test_existing_request(user_key, group_key, 'admin')
				if req_key:
					req_key.delete()
				
				# if leaving user is also an admin
				if user_key in group.admins:
					# remove user from admin list
					group.admins.remove(user_key)

					# remove group from user's admin_groups
					user.admin_groups.remove(group_key)

			ndb.put_multi([user, group])
			return True

class GroupPost(ndb.Model):
	group_id = ndb.StringProperty(required = True, indexed = True)
	user_id = ndb.StringProperty(required = True, indexed = True)
	post = ndb.TextProperty(required = True, indexed = False)
	created = ndb.IntegerProperty(required = True, indexed = True)

	@classmethod
	def create_group_post(cls, group_id, user_id, post):
		group_post_id = GroupPost.allocate_ids(size=1)[0]

		# isspace checks if post only has spaces, newlines or tabs
		if not post or post.isspace():
			raise BadUserInputError('post content cannot be blank')

		#call strip on post to remove extra white space on start/end
		group_post = GroupPost(id = group_post_id,
								group_id = group_id,
								user_id = user_id,
								post = post.strip(),
								created = int(time.time()))

		group_post_key = group_post.put()
		return group_post_key

	@classmethod
	def fetch_posts_by_group(cls, group_id):
		group_posts = GroupPost.query(GroupPost.group_id == group_id).order(-GroupPost.created).fetch()
		if group_posts:
			return group_posts
		else:
			return None

