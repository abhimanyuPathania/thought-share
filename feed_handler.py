import logging
import time
import json

from google.appengine.api import memcache
from google.appengine.ext import ndb

from utility_handler import Handler
from models import User, Group

from notification_handler import create_notifications

class FeedHandler(Handler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		user_id = self.user_id
		user_email = self.user.email()
		memcache_test = memcache.get(user_id, namespace = 'users')
		user = None

		if not memcache_test:
			# a new user or stale cache
			user = User.get_by_id(user_id)
			if not user:
				# first time user, creat new User entity
				User.create_user(user_id, user_email)
				return self.render('feed.html', display_name = user_email,
												group_json = json.dumps([]))
			else:
				#user exists but not in cache...re-update cache
				memcache.set(user_id, True, namespace = 'users')


		if not user:
			#only query for existing users if not already queried due to cache
			user = User.get_by_id(user_id)

		display_name = user.display_name or user.email
		groups_list = []
		if len(user.groups) > 0:
			user_groups = ndb.get_multi(user.groups)
			for g in user_groups:
				temp = {}
				temp["name"] = g.name
				temp["id"] = g.key.id()
				groups_list.append(temp)

		group_json = json.dumps(groups_list)
		return self.render('feed.html', display_name = display_name,
										group_json = group_json)

class GetUserGroupsAjax(Handler):
	def get(self):
		if not self.user:
			return None

		user = User.get_by_id(self.user_id)
		groups_joined = ndb.get_multi(user.groups)
		group_list = []

		for g in groups_joined:
			temp = {}
			temp["name"] = g.name
			temp["id"] = g.key.id()
			group_list.append(temp)

		self.render_json(group_list)