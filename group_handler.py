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
from helper_db_operations import *

from constants import GROUP_LP_RECENT_POSTS_THUMB
from constants import GROUP_LP_CREATOR_THUMB
from constants import GROUP_LP_GROUP_THUMB
from constants import GROUP_DESCRIPTION_CHAR_LIMIT

class CreateGroupHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	def get(self):
		if not self.account:
			return self.redirect('/')

		self.render('create_group.html', description_limit = GROUP_DESCRIPTION_CHAR_LIMIT)

	def post(self):
		if not self.account:
			return self.fail_ajax()

		data = {'creator': self.user_key,
				'name' : self.request.get('name'),
				'description' : self.request.get('description'),
				'private' : self.request.get('private')}

		try:
			cover_image_blob_info = self.get_uploads()[0]
		#catch if user does not upload an image
		except IndexError:
			cover_image_blob_info = None

		data['cover_image_blob_info'] = cover_image_blob_info
		
		try:
			new_group_key = Group.create_group(**data)	
		
		# invalid group name, or group with the same name already exsits
		except (BadUserInputError, EntityExistsError) as e:
			
			#delete the blob if uploaded
			if cover_image_blob_info:
				blobstore.delete([cover_image_blob_info.key()])
			
			return self.fail_ajax(e.value)

		#if blob is too big or not an image type
		except BadImageError as e:
			
			#delete the incorrect blob uploaded
			blobstore.delete([cover_image_blob_info.key()])

			return self.fail_ajax(e.value)

		#!!!!!catch datastore put exceptions here
		group_url = '/group/' + new_group_key.id()
		return self.render_json(group_url)

class GroupLandingPageHandler(Handler):
	# /group/(group_id)

	def get(self, group_id_sent):
		if not self.account:
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
											  "created",
											  "creator",
											  "members",
											  "admins"])
		group_data["id"] = group_id

		#add default group image flag
		image_url = group_data["cover_image_url"]
		group_data["default_image"] = False if image_url else True
		
		# add the actual image urls
		group_data["cover_image_url"] = get_thumbnail_url(image_url, 0, 'group')
		#add thumbnail
		group_data["cover_image_thumbnail"] = get_thumbnail_url(image_url,
																GROUP_LP_GROUP_THUMB,
																'group')
		#add group description limit
		group_data["description_limit"] = GROUP_DESCRIPTION_CHAR_LIMIT

		#add the member,admin flags
		group_data["member"] = member
		group_data["admin"] = admin
		group_data["render_edit"] = allowed_to_edit

		# if allowed_to_edit:
			#group_data["form_action"] = blobstore.create_upload_url('/edit-group/' + group_id)
			#group_data["form_action"] = blobstore.create_upload_url('/ajax/upload-image')

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
		group_data["creator_name"] = creator.display_name
		group_data["creator_image"] = get_thumbnail_url(creator.image_url,
														GROUP_LP_CREATOR_THUMB, 'user')

		#add recent posts in group
		#default value for private group and not member
		recent_posts = None

		#poster_info is a flag for jinja to add poster tags of not
		group_data["poster_info"] = False
		if member:
			recent_posts_data = get_feed(group_id = group_id,
									     cursor_str=None,
									     add_poster = True,
									     thumbnail_size = GROUP_LP_RECENT_POSTS_THUMB)

			recent_posts = recent_posts_data["post_list"]
			group_data["poster_info"] = True
		else:
			# not a group member
			if not group.private:
				# public group/not member
				# don't add poster imformations
				recent_posts_data = get_feed(group_id = group_id,
											 cursor_str = None,
											 add_poster = False)
				recent_posts = recent_posts_data["post_list"]
		
		group_data["recent_posts"] = recent_posts

		#set seperate group_json to be used by JavaScript
		group_json = {"name": group_data["name"],
					  "id": group_data["id"],
					  "private": group_data["private"],
					  "allowed_to_edit": allowed_to_edit}
		#render group landing page
		return self.render('group_landing_page.html', g = group_data,
													  group_json = json.dumps(group_json))

class GroupEditHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	# /ajax/edit-group

	def get(self):
		if not self.account:
			return self.redirect('/')

		description = self.request.get('description')
		group_id = self.request.get('group_id')

		if not description or description.isspace():
			#blank submission
			return self.fail_ajax();

		try:
			edit_operation = Group.edit_group(self.user_key, group_id, description)	
		except:
			pass

		if not edit_operation:
			return self.fail_ajax();

		return self.render_json(True)


class GroupJoiningHandler(Handler):
	# /ajax/join-group

	def get(self):
		if not self.account:
			return self.fail_ajax()

		group_id = self.request.get('group_id')

		user_key = self.user_key
		group_key = ndb.Key(Group, group_id)
		group_joined = Group.join_group(user_key, group_key)

		if group_joined:
			return self.render_json(True)
		else:
			return self.fail_ajax()

class GroupLeavingHandler(Handler):
	# /ajax/leave-group

	def get(self):
		if not self.account:
			return self.fail_ajax()

		group_id = self.request.get('group_id')

		user_key = self.user_key
		group_key = ndb.Key(Group, group_id)
		
		group_left = Group.leave_group(user_key, group_key)

		if group_left:
			return self.render_json(True)
		else:
			return self.fail_ajax()

class GroupRequestAdminHandler(Handler):
	# /ajax/admin-group

	def get(self):
		if not self.account:
			return self.fail_ajax()

		group_id = self.request.get('group_id')

		user_key = self.user_key
		group_key = ndb.Key(Group, group_id)

		user_and_group = ndb.get_multi([user_key, group_key])
		user = user_and_group[0]
		group = user_and_group[1]

		# don't raise admin request until user in not a member of group
		# or the user is already an admin of the group
		if group_key not in user.groups or user_key in group.admins:
			return self.fail_ajax()

		test = PrivateRequest.test_existing_request(user_key, group_key, 'admin')
		if test:
			return self.fail_ajax()

		req = PrivateRequest.raise_request(group, user, 'admin')
		return self.render_json(True)

class GroupPostHandler(Handler):
	# /ajax/post-group

	def get(self):
		return self.redirect('/')

	def post(self):
		if not self.account:
			return self.fail_ajax()

		user_post = self.request.get('user_post')
		group_id = self.request.get('target_group')

		# check if user is a member of group
		group = Group.get_by_id(group_id)

		if not group or (self.user_key not in group.members):
			return self.fail_ajax()
		try:
			post_key, post_data = GroupPost.create_group_post(group_id, group.name,
															  self.user_id, user_post)
		except BadUserInputError as e:
			# raised on blank posts
			return self.fail_ajax()

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
		return self.render_json(post_data)

class DeletePostHandler(Handler):
	# /ajax/delete-post

	def post(self):
		if not self.account:
			return self.fail_ajax()

		urlsafe = self.request.get('post_id')
		group_post = ndb.Key(urlsafe = urlsafe).get()
		# can delete only your own posts
		if not group_post or group_post.user_id != self.user_id:
			return self.fail_ajax()

		group_post.key.delete()
		return self.render_json(True)

class EditPostHandler(Handler):
	# /ajax/edit-post

	def post(self):
		if not self.account:
			return self.fail_ajax()

		urlsafe = self.request.get('post_id')
		post_content = self.request.get('post_content')

		if not post_content or post_content.isspace():
			return self.fail_ajax()

		group_post = ndb.Key(urlsafe = urlsafe).get()
		# can delete only your own posts
		if not group_post or group_post.user_id != self.user_id:
			return self.fail_ajax()

		group_post.post = post_content
		group_post.put()
		return self.render_json(True)


class GetGroupFeedHandler(Handler):
	# /ajax/get-group-feed

	def get(self):
		if not self.account:
			return self.fail_ajax()

		group_id = self.request.get('group_id')
		cursor_str = self.request.get('cursor_str')

		#use python's None instead of blank string
		if not cursor_str:
			cursor_str = None

		group = Group.get_by_id(group_id)
		user_key = self.user_key

		if group and user_key in group.members:
			feed_result = get_feed(group_id = group_id,
								   cursor_str = cursor_str)
			return self.render_json(feed_result)
		else:
			return self.fail_ajax()

class UpdateGroupFeedHandler(Handler):
	# /ajax/update-group-feed

	def get(self):
		if not self.account:
			return self.fail_ajax()

		group_id = self.request.get('group_id')
		current_timestamp = int(self.request.get('latest_timestamp'))
		
		# check if user is a member
		group = Group.get_by_id(group_id)
		user_key = self.user_key
		if group and user_key in group.members:
			updates = update_group_feed(group_id, current_timestamp)
			if not updates:
				#return null for no posts but group exists
				return self.render_json(None)

			return self.render_json(updates)
		else:
			# user not eligible for posts, invalid request
			return self.fail_ajax()

class GroupTextSearchHandler(Handler):
	# /ajax/group-text-search
	
	def get(self):
		if not self.account:
			return self.fail_ajax()

		query_string = self.request.get("q")
		if not check_query_string(query_string):
			return self.fail_ajax()

		search_results = search_index(query_string)
		if not search_results:
			return self.render_json(None)

		return self.render_json(search_results)


		






