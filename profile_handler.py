
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
		user_data = user.to_dict(include=['display_name', 'email', 'image_url'])
		user_data['form_action'] = blobstore.create_upload_url('/edit-profile')
		user_data['default_image'] = False if user_data['image_url'] else True

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
			# return None for not fetching since user already has it

			# data is returned as following dict with both fields as lists
			# 'all_groups_data' is None for user not having joined any group

			# {'all_groups_data': None,
			#  'admin_group_ids' : None}
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

class EditProfileHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	# /edit-profile

	def post(self):
		if not self.account:
			return self.redirect('/')

		display_name = self.request.get('display_name')
		try:
			blob = self.get_uploads()[0]
		except IndexError:
			blob = None

		if not blob and not display_name:
			#blank submission
			return self.redirect('/view-profile')	

		try:
			User.edit_user(self.user_id, display_name, blob)
		except BadUserInputError as e:
			#delete the incorrect blob uploaded if there
			if blob:			
				blobstore.delete([blob.key()])
			return self.redirect('/')
		
		except BadImageError as e:
			#delete the incorrect blob uploaded
			blobstore.delete([blob.key()])
			return self.redirect('/')

		# re-render the profile page on success
		return self.redirect('/view-profile')
		

class DeleteImageHandler(Handler):
	# /ajax/delete-image

	def post(self):
		if not self.account:
			return self.fail_ajax()

		image_type = self.request.get('image_type')

		group_key = None
		if image_type == 'group':
			group_id = self.request.get('group_id')
			group_key = ndb.Key(Group, group_id)

		delete_operation = delete_image(image_type, self.user_key, group_key)

		if not delete_operation:
			return self.fail_ajax()

		return self.render_json(True) 

