
from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

from utility_handler import Handler

from models import User
from helper_functions import BadUserInputError, BadImageError

class ViewProfileHandler(Handler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		user = User.get_by_id(self.user.user_id())
		display_name = user.display_name
		if not display_name:
			display_name = 'Not set'
		return self.render('view_profile.html', display_name = display_name,
												email = user.email,
												user_image_url = user.image_url,
												user_thumbnail_url = user.thumbnail_url)


#!!!!!!!!!!!!!!!!!!!!!---------add the option to remove photo
class EditProfileHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	def get(self):
		if not self.user:
			return self.redirect('/')

		user = User.get_by_id(self.user.user_id())
		display_name = user.display_name
		image_url = user.image_url

		if not display_name:
			display_name = 'Not set'
		
		image_upload_url = blobstore.create_upload_url('/edit-profile')
		self.render('edit_profile.html', display_name = display_name,
										user_image_url = image_url,
										form_action = image_upload_url)

	def post(self):
		if not self.user:
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
			#reacreate image upload url since the old one gives error
			image_upload_url = blobstore.create_upload_url('/edit-profile')
			return self.render('edit_profile.html', error = e.value,
													form_action = image_upload_url)
		
		except BadImageError as e:
			#delete the incorrect blob uploaded
			blobstore.delete([blob.key()])

			#re-create upload url and render back the form
			image_upload_url = blobstore.create_upload_url('/edit-profile')
			return self.render('edit_profile.html', error = e.value,
													form_action = image_upload_url)

		return self.redirect('/view-profile')

