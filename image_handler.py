
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers
from google.appengine.api import images

from utility_handler import Handler

class PhotoFormHandler(Handler):
	def get(self):
		upload_url = blobstore.create_upload_url('/upload_photo')
		self.render('photo_form.html', action = upload_url)

class PhotoUploadHandler(blobstore_handlers.BlobstoreUploadHandler):
    def post(self):
        upload = self.get_uploads()[0]
        blob_key = upload.key()
        full_image = images.get_serving_url(blob_key)
        thumbnail_url = images.get_serving_url(blob_key, size = 100, crop = False)

        user_photo = UserPhoto(user=DUMMY_USER,
                               blob_key= blob_key,
                               full_image = full_image,
                               thumbnail = thumbnail_url)
        user_photo.put()
        self.redirect('/view_photo')

class DownloadPhotoHandler(blobstore_handlers.BlobstoreDownloadHandler):
    def get(self):
    	photo_key = UserPhoto.query(UserPhoto.user == DUMMY_USER).get().blob_key
        if not blobstore.get(photo_key):
            self.error(404)
        else:
            self.send_blob(photo_key)

class ViewPhotoHandler(Handler):
    def get(self):
        photo = UserPhoto.query(UserPhoto.user == DUMMY_USER).get()
        self.render('photo_page.html', image_url = photo.full_image,
                                        thumbnail_url = photo.thumbnail)
