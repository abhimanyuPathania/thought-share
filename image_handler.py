import logging

from google.appengine.ext import ndb
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers

from utility_handler import Handler
from models import User, Group

from helper_functions import check_uploaded_image
from helper_functions import BadImageError

from helper_operations import delete_image, upload_image


class GetImageUploadUrlHandler(Handler):
	# /ajax/get-image-upload-url
	
	def get(self):
		# takes target_url as AJAX parameter and returns the upload URL for blobstore
		if not self.account:
			return self.fail_ajax("User account not found")

		target_url = self.request.get('target_url')
		upload_url = blobstore.create_upload_url(target_url)

		return self.render_json(upload_url)



class DeleteImageHandler(Handler):
	# /ajax/delete-image

	def get(self):
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

class UploadImageHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
	# /ajax/upload-image

	def post(self):
		if not self.account:
			return self.redirect('/')

		try:
			blob_info = self.get_uploads()[0]
		except IndexError:
			# nothing uploaded
			logging.error("NOTHING UPLOADED")
			return self.fail_ajax()

		# check the image file uploaded
		try:
			check_uploaded_image(blob_info)
		except BadImageError:
			# bad image upload
			# delete the incorrect blob uploaded
			blobstore.delete([blob_info.key()])
			logging.error("BAD IMAGE")
			return self.fail_ajax()


		image_type = self.request.get('image_type')
		group_key = None
		if image_type == 'group':
			group_id = self.request.get('group_id')
			group_key = ndb.Key(Group, group_id)

		# return the new serving image url
		updated_serving_url = upload_image(image_type, blob_info, self.user_key, group_key)
		
		if not updated_serving_url:
			logging.error("NO UPDTED SERVING URL")
			return self.fail_ajax()

		return self.render_json(updated_serving_url)