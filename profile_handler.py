import time

from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

from utility_handler import Handler
from models import User, Group

from view_profile_functions import *
from helper_operations import get_group_data, delete_image
from helper_functions import BadUserInputError, BadImageError

class ViewProfileHandler(Handler):
	# /view-profile
	# this handler simply renders the view-profile page

	def get(self):
		if not self.account:
			return self.redirect('/')

		user = self.user_key.get()
		user_data = user.to_dict(include=['display_name'])

		return self.render('view_profile.html', u = user_data)

class ProfileDataHandler(Handler):
	# /ajax/get-profile-data
	# requests to this handler are used fetch data for /view-profile
	
	def get(self):
		if not self.account:
			return self.fail_ajax()

		view = self.request.get('view')
		data = None

		if view == 'groups':
			# Return None for not fetching since user already has it.

			# Data is returned as a list.
			# An empty list if user has not joined any groups.

			data = get_user_groups(self.user_key)

		if view == 'posts':
			# returns dict as returned by get_feed in helper_db_operations
			cursor_str = self.request.get('cursor_str')
			data = get_user_posts(self.user_id, cursor_str)

		if view == 'notifications':
			# 'timestamp = 0' for initial fetch
			# None - for no notifications yet present
			# [] - empty list for exhausting all notifications in memcache
			timestamp = int(self.request.get('timestamp'))
			data = get_user_notifications(self.user_id, timestamp)

		# view == 'requests' is handled by RequestNotificationHandler
		# at the url '/ajax/get-request-notifications', as in the request ko component

		return self.render_json(data)

class EditProfileHandler(Handler):
	# /ajax/edit-profile

	def post(self):
		if not self.account:
			return self.fail_ajax()

		display_name = self.request.get('display_name')		

		try:
			User.edit_user(self.user_id, display_name)
		except BadUserInputError:
			return self.fail_ajax()

		return self.render_json(True)
		



