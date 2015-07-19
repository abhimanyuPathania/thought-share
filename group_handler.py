import logging
import time
import json

from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

from utility_handler import Handler
from models import *
from notification_handler import create_notifications
from helper_functions import *
from helper_operations import *
from helper_db_operations import get_group_feed


class CreateGroupHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		image_upload_url = blobstore.create_upload_url('/create-group')
		self.render('create_group.html', form_action = image_upload_url)

	def post(self):
		if not self.user:
			return self.redirect('/')

		data = {'creator': self.user_key,
				'name' : self.request.get('name'),
				'description' : self.request.get('description'),
				'private' : self.request.get('private')}

		try:
			cover_image_blob = self.get_uploads()[0]
		#catch if user does not upload an image
		except IndexError:
			cover_image_blob = None

		data['cover_image_blob'] = cover_image_blob
		try:
			Group.create_group(**data)	
		# invalid group name, or group with the same name already exsits
		except (BadUserInputError, EntityExistsError) as e:
			image_upload_url = blobstore.create_upload_url('/create-group')
			return self.render('create_group.html', error = e.value,
													form_action = image_upload_url)
		#if blob is too big or not an image type
		except BadImageError as e:
			#delete the incorrect blob uploaded
			blobstore.delete([cover_image_blob.key()])

			#re-create upload url and render back the form
			image_upload_url = blobstore.create_upload_url('/create-group')
			return self.render('create_group.html', error = e.value,
													form_action = image_upload_url)
		#!!!!!catch datastore put exceptions here

		return self.redirect('/feed')

class GroupLandingPageHandler(Handler):
	# /group/([a-z0-9-]{3,20})

	def get(self, group_id_sent):
		if not self.user:
			return self.redirect('/')

		# sanitizing group name, just in case
		group_id = get_group_id(sanitize_group_name(group_id_sent))
		group = Group.get_by_id(group_id)

		# raise error 404 here
		if not group:
			return self.render('/')

		# establish if user is a group member
		user_key = self.user_key
		member = False
		if user_key in group.members:
			member = True

		# establish if user is a group admin
		admin = False
		if member and user_key in group.admins:
			admin = True

		# establish if user has right to edit the group
		allowed_to_edit = False
		if group.private:
			allowed_to_edit = user_key in group.admins
		else:
			allowed_to_edit = user_key == group.creator

		# start to build group_data dictionary
		# exclude what is not required or cannot be added directly by the method
		group_data = group.to_dict(exclude = ["cover_image_blob_key", 
											  "cover_image_thumbnail",
											  "created",
											  "creator",
											  "members",
											  "admins"])
		group_data["id"] = group_id

		#add the member,admin flags
		group_data["member"] = member
		group_data["admin"] = admin
		group_data["render_edit"] = allowed_to_edit

		# add flags to render join/request admin/leave buttons
		# if group is private, check if user has any join/admin requests
		if group.private:

			#if user is a not a member
			if member:
				# only considering case of not admin
				if not admin:
					request = PrivateRequest.test_existing_request(user_key, group.key, 'admin')
					if request:
						group_data["admin_request"] = True
					else:
						group_data["admin_request"] = False
			
			#if user is a not a member, he can only have a join request
			else:
				request = PrivateRequest.test_existing_request(user_key, group.key, 'join')
				# this flag tells template to render the join button or
				# tell the user that his join request is pending
				if request:
					group_data["render_join"] = False
				else:
					group_data["render_join"] = True

		#add no. of members
		group_data["members_number"] = len(group.members)
		# if user is not a member and group is private; don't show members_number
		if not member and group.private:
			group_data["members_number"] = None

		#add creator information
		creator = group.creator.get()
		group_data["creator_name"] = (creator.display_name or creator.email)
		group_data["creator_image"] = creator.thumbnail_url

		#add recent posts in group
		#default value for private group and not member
		recent_posts = None

		#poster_info is a flag for jinja to add poster tags of not
		group_data["poster_info"] = False
		if member:
			recent_posts = get_group_feed(group_id, limit = 10)
			group_data["poster_info"] = True
		else:
			#not a group member
			if not group.private:
				#public group/not member
				#don't add poster imformations
				recent_posts = get_group_feed(group_id, add_poster = False, limit = 10)
		
		group_data["recent_posts"] = recent_posts

		#set seperate group_json to be used by Javascript
		#!!!!!!!!!!!!!add image url, form url's for the editing modal
		group_json = {"name": group_data["name"],
					  "id": group_data["id"],
					  "private": group_data["private"]}
		#render group landing page
		return self.render('group_landing_page.html', g = group_data,
													  group_json = json.dumps(group_json))

#!!!!!!!!!!!!!!!!!!!!!---------add the option to remove photo
class GroupEditHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	# /update-group/([a-z0-9-]{3,20})
	
	def get(self, group_id):
		if not self.user:
			return self.redirect('/')

		group = Group.get_by_id(group_id)
		user_key = self.user_key
		if not group:
			return None

		allowed = None
		if group.private:
			allowed = user_key in group.admins
		else:
			allowed = user_key == group.creator

		if not allowed:
			return self.redirect('/feed')

		data = {
			'name': group.name,
			'image': group.cover_image_thumbnail,
			'description': group.description,
			'form_action' : blobstore.create_upload_url('/edit-group/' + group_id)
		}
		return self.render('edit_group.html', g = data)

	def post(self, group_id):
		if not self.user:
			return self.redirect('/')

		description = self.request.get('description')
		try:
			blob = self.get_uploads()[0]
		except IndexError:
			blob = None

		if not description and not blob:
			#blank submission
			return self.redirect('/edit-group/' + group_id)

		try:
			Group.edit_group(self.user_key, group_id, description, blob)
		#if blob is too big or not an image type
		except BadImageError as e:
			#delete the incorrect blob uploaded
			blobstore.delete([blob.key()])

			#re-create upload url, group_data and render back the form
			group = Group.get_by_id(group_id)
			data = {
				'name': group.name,
				'image': group.cover_image_thumbnail,
				'description': group.description,
				'form_action' : blobstore.create_upload_url('/edit-group/' + group_id)
			}
			return self.render('edit_group.html', error = e.value,
													g = data)

		return self.redirect('/group/' + group_id)


class GroupJoiningHandler(Handler):
	# /join-group/([a-z0-9-]{3,20})

	def get(self, group_id):
		if not self.user:
			return self.redirect('/')

		user_key = self.user_key
		group_key = ndb.Key(Group, group_id)
		group_joined = Group.join_group(user_key, group_key)

		if group_joined:
			return self.redirect('/feed')
		else:
			return self.redirect('/group/%s' % group_id)

class GroupLeavingHandler(Handler):
	# /leave-group/([a-z0-9-]{3,20})

	def get(self, group_id):
		if not self.user:
			return self.redirect('/')

		user_key = self.user_key
		group_key = ndb.Key(Group, group_id)
		
		group_left = Group.leave_group(user_key, group_key)

		if group_left:
			return self.redirect('/feed')
		else:
			return self.redirect('/group/%s' % group_id)

class GroupRequestAdminHandler(Handler):
	# /admin-group/([a-z0-9-]{3,20})
	def post(self, group_id):
		if not self.user:
				return self.redirect('/')

		user_key = self.user_key
		group_key = ndb.Key(Group, group_id)

		user_and_group = ndb.get_multi([user_key, group_key])
		user = user_and_group[0]
		group = user_and_group[1]

		# don't raise admin request until user in not a member of group
		# or the user is already an admin of the group
		if group_key not in user.groups or user_key in group.admins:
			return self.redirect('/group/%s' % group_id)

		test = PrivateRequest.test_existing_request(user_key, group_key, 'admin')
		if test:
			return self.redirect('/group/%s' % group_id)

		req = PrivateRequest.raise_request(group, user, 'admin')
		return self.redirect('/feed')

class GroupPostHandler(Handler):
	def get(self):
		return self.redirect('/')

	def post(self):
		if not self.user:
			return self.redirect('/')

		user_post = self.request.get('user_post')
		group_id = self.request.get('target_group')

		# check if user is a member of group
		group = Group.get_by_id(group_id)

		if not group or (self.user_key not in group.members):
			return self.fail_ajax(400, "not a group member")

		try:
			post_key = GroupPost.create_group_post(group_id, self.user_id, user_post)
		except BadUserInputError as e:
			return self.fail_ajax(400, e.value)

		#create notification content
		data = {'post_key': post_key,
				'poster_key': self.user_key,
				'group_name': group.name,
				'group_id': group_id,
				'ntf_type': 'post'}
		notification = create_notification_dict(**data)

		#get notification receiving members by removing the posting user
		notification_target_members = group.members
		notification_target_members.remove(self.user_key)

		create_notifications(notification_target_members, notification)
		return self.render_json(True)


class GetGroupFeedHandler(Handler):
	# /ajax/get-group-feed

	def get(self):
		if not self.user:
			return None

		group_id = get_group_id(sanitize_group_name(self.request.get('gid')))
		group = Group.get_by_id(group_id)
		user_key = self.user_key

		if group and user_key in group.members:
			feed = get_group_feed(group_id)
			if not feed:
				#return null for no posts but group exists
				return self.render_json(None)
			return self.render_json(feed)
		else:
			return self.fail_ajax()

class GroupTextSearchHandler(Handler):
	# /ajax/group-text-search
	
	def get(self):
		if not self.user:
			return None

		query_string = self.request.get("q")
		if not check_query_string(query_string):
			return self.fail_ajax()

		search_results = search_index(query_string)
		if not search_results:
			return self.render_json(None)

		return self.render_json(search_results)
		






