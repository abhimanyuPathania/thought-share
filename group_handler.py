import logging
import time

from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

from utility_handler import Handler
from models import Group, GroupPost, User, PrivateRequest
from helper_functions import BadUserInputError, EntityExistsError
from helper_functions import sanitize_group_name, get_group_id
from notification_handler import create_notifications, get_notifications


class CreateGroupHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		image_upload_url = blobstore.create_upload_url('/create-group')
		self.render('create_group.html', form_action = image_upload_url)

	def post(self):
		if not self.user:
			return self.redirect('/')

		creator_key = ndb.Key(User, self.user.user_id())
		group_name = self.request.get('name')
		#make group description required
		group_description = self.request.get('description')
		private = self.request.get('private')

		try:
			cover_image = self.get_uploads()[0]
		except Exception:
			cover_image = None
		
		blob_key = None
		if cover_image:
			blob_key = cover_image.key()

		try:
			Group.create_group(group_name, group_description, creator_key, private, blob_key)
		except BadUserInputError as e:
			image_upload_url = blobstore.create_upload_url('/create-group')
			return self.render('create_group.html', error = e.value,
													form_action = image_upload_url)
		except EntityExistsError as e:
			image_upload_url = blobstore.create_upload_url('/create-group')
			return self.render('create_group.html', error = e.value,
													form_action = image_upload_url)

		return self.redirect('/feed')

class GroupLandingPageHandler(Handler):
	def get(self, name):
		if not self.user:
			return self.redirect('/')

		group_id = get_group_id(sanitize_group_name(name))
		group = Group.get_by_id(group_id)
		user_key = ndb.Key(User, self.user.user_id())

		member = False
		if group:
			if user_key in group.members:
				member = True
			group_posts = GroupPost.fetch_posts_by_group(group_id)
			return self.render('group_landing_page.html', group_id = group_id,
														group_name = group.name,
														group_description = group.description,
														private = group.private,
														member = member,
														group_posts = group_posts,
														group_cover_image = group.cover_image_url)
		else:
			return self.render('group_landing_page.html', group_name = 'NOT FOUND!')

class GroupJoiningHandler(Handler):
	def get(self, group_id):
		if not self.user:
			return self.redirect('/')

		user_key = ndb.Key(User, self.user.user_id())
		group_key = ndb.Key(Group, group_id)
		group_joined = Group.join_group(user_key, group_key)

		if group_joined:
			return self.redirect('/feed')
		else:
			return self.redirect('/group/%s' % group_id)

class GroupRequestAdminHandler(Handler):
	def post(self, group_id):
		if not self.user:
				return self.redirect('/')

		user = User.get_by_id(self.user.user_id())
		group = Group.get_by_id(group_id)
		req = PrivateRequest.raise_request(group, user, 'admin')

		return self.redirect('/feed')

class GroupLeavingHandler(Handler):
	def get(self, group_id):
		if not self.user:
			return self.redirect('/')

		user_key = ndb.Key(User, self.user.user_id())
		group_key = ndb.Key(Group, group_id)
		
		group_left = Group.leave_group(user_key, group_key)

		if group_left:
			return self.redirect('/feed')
		else:
			return self.redirect('/group/%s' % group_id)

class GroupPostHandler(Handler):
	def get(self, group_id):
		if not self.user:
			return self.redirect('/')

		return self.render('group_post.html', group_id = group_id)

	def post(self, group_id):
		if not self.user:
			return self.redirect('/')

		user_id = self.user.user_id()
		user_post = self.request.get('user_post')

		try:
			GroupPost.create_group_post(group_id, user_id, user_post)
		except BadUserInputError as e:
			return self.render('group_post.html', error = e.value,
												group_id = group_id)

		#get user_key and name to create notification content
		user_key = ndb.Key(User, user_id)
		user_email = user_key.get().email

		#get group name and members for notification target
		group = Group.get_by_id(group_id)

		#create notification content
		notification = {'poster_name': user_email,
						'group_name': group.name,
						'timestamp': str((int(time.time()))),
						'read': 'False'}

		#get notification receiving members by removing the posting user
		notification_target_members = group.members
		notification_target_members.remove(user_key)

		create_notifications(notification_target_members, notification)
		return self.redirect('/feed')





