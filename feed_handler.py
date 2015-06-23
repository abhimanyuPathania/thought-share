import logging
import time

from google.appengine.api import memcache
from google.appengine.ext import ndb

from utility_handler import Handler
from models import User, Group

from notification_handler import create_notifications, get_notifications

class FeedHandler(Handler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		user_id = self.user.user_id()
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
												groups_joined = None)
			else:
				#user exists but not in cache...re-update cache
				memcache.set(user_id, True, namespace = 'users')


		if not user:
			#only query for existing users if not already queried due to cache
			user = User.get_by_id(user_id)

		groups_joined = ndb.get_multi(user.groups)
		notifications = get_notifications(user_id)
		display_name = user.display_name or user.email
		return self.render('feed.html', display_name = display_name,
										groups_joined = groups_joined,
										notifications = notifications)