import logging
import time

from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

from utility_handler import Handler
from models import Group, GroupPost, User, PrivateRequest
from helper_functions import BadUserInputError, EntityExistsError
from helper_functions import sanitize_group_name, get_group_id, get_post_timestamp
from notification_handler import create_notifications


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

		user_key = self.user_key
		group_key = ndb.Key(Group, group_id)
		group_joined = Group.join_group(user_key, group_key)

		if group_joined:
			return self.redirect('/feed')
		else:
			return self.redirect('/group/%s' % group_id)

class GroupLeavingHandler(Handler):
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
			return self.redirect('/feed')

		req = PrivateRequest.raise_request(group, user, 'admin')
		return self.redirect('/feed')

class GroupPostHandler(Handler):
	def get(self, group_id):
		if not self.user:
			return self.redirect('/')

		return self.render('group_post.html', group_id = group_id)

	def post(self, group_id):
		if not self.user:
			return self.redirect('/')

		user_post = self.request.get('user_post')

		# check if user is a member of group
		user = self.user_key.get()
		group = Group.get_by_id(group_id)
		if self.user_key not in group.members:
			return self.render('/')

		try:
			post_key = GroupPost.create_group_post(group_id, self.user_id, user_post)
		except BadUserInputError as e:
			return self.render('group_post.html', error = e.value,
												group_id = group_id)

		#get poster_name to create notification content
		poster_name = user.display_name or user.email

		#create notification content
		notification = {'post_id': post_key.urlsafe(),
						'poster_name': poster_name,
						'poster_image': user.thumbnail_url,
						'group_name': group.name,
						'group_id': group_id,
						'group_image': group.cover_image_thumbnail,
						'timestamp': str((int(time.time()))),
						'read': 'False'}

		#get notification receiving members by removing the posting user
		notification_target_members = group.members
		notification_target_members.remove(self.user_key)

		create_notifications(notification_target_members, notification)
		return self.redirect('/feed')


class GetGroupFeedAjax(Handler):
	def get(self):
		if not self.user:
			return None

		group_id = get_group_id(sanitize_group_name(self.request.get('gid')))
		group = Group.get_by_id(group_id)
		user_key = self.user_key

		if group and user_key in group.members:
			group_posts = GroupPost.fetch_posts_by_group(group_id)
			if not group_posts:
				#return null for no posts but group exists
				return self.render_json(None)

			feed = []
			user_key_list = []
			for post in group_posts:
				p = {}
				p["created"] = post.created
				p["post"] = post.post
				p["post_id"] = post.key.urlsafe()
				feed.append(p)

				#also make a list of keys users who posted
				user_key = ndb.Key(User, post.user_id)
				user_key_list.append(user_key)

			posters = ndb.get_multi(user_key_list)
			for i in range(len(feed)):
				#now add the user info to the feed post
				feed[i]["poster_name"] = (posters[i].display_name or posters[i].email)
				feed[i]["poster_image"] = posters[i].thumbnail_url

			return self.render_json(feed)




