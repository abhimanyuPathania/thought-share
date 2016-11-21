import webapp2
import datetime

from google.appengine.api import users
from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers


from utility_handler import Handler
from feed_handler import *
from group_handler import *
from notification_handler import *
from profile_handler import *
from navbar_handler import *
from widget_handler import *
from image_handler import *

from models import *

from helper_functions import BadUserInputError, BadImageError
from helper_operations import search_index

class LandingPageHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
    
    def get(self):
    	if not self.user:
    		return self.render('index.html')
        
        # means user is atleast logged in to his google account
        # check for the user account too
        if self.account:
            return self.redirect('/feed')
        
        # only render the cerate user page if the user is not in db
        return self.render('create_user.html', email = self.user.email())

    def post(self):
        if not self.user:
            return self.render('index.html')

        if self.account:
            return self.redirect('/feed')

        # if reaches here means we have to ceate the account

        # force user to enter his display name here
        display_name = self.request.get('display_name')

        # Image upload is optional. Put the blob_info get in try.
        try:
            blob_info = self.get_uploads()[0]
        except IndexError:
            blob_info = None 

        # Bad request. Display name must be submitted.
        if not display_name:
            # delete orphan blob_info
            if blob_info:
                blobstore.delete([blob_info.key()])
            return self.fail_ajax("Display name not entered.")

        try:
            User.create_user(self.user_id, display_name, self.user.email(), blob_info)
        
        except BadUserInputError as e:
            # delete orphan blob_info
            if blob_info:
                blobstore.delete([blob_info.key()])
            return self.fail_ajax(e.value)
        
        except BadImageError as e:
            #delete the incorrect blob_info uploaded
            blobstore.delete([blob_info.key()])
            return self.fail_ajax(e.value)
        
        # user account created
        return self.render_json(True)

class CreatingAccountUrlHandler(Handler):
    # /ajax/get-creating-account-url
    
    def get(self):
        # takes target_url as AJAX parameter and returns the upload URL for blobstore
        upload_url = blobstore.create_upload_url('/')
        return self.render_json(upload_url)
        	

class DatastoreHandler(Handler):
    def get(self):
        user = self.user_key.get()
        result_tuple = PrivateRequest.fetch_requests(user.admin_groups, None, True)

        self.render('datastore.html', result = result_tuple[0],
                                      result2 = result_tuple[1])
        

app = webapp2.WSGIApplication([
    ('/', LandingPageHandler),
    ('/ajax/get-navbar-data', NavbarHandler),
    ('/feed', FeedHandler),
    ('/view-profile', ViewProfileHandler),
    ('/ajax/edit-profile', EditProfileHandler),
    ('/ajax/get-profile-data', ProfileDataHandler),  
    ('/create-group', CreateGroupHandler),
    (r'/group/([a-z0-9-]{3,50})', GroupLandingPageHandler),
    ('/ajax/join-group', GroupJoiningHandler),
    ('/ajax/admin-group', GroupRequestAdminHandler),
    ('/ajax/leave-group', GroupLeavingHandler),
    ('/ajax/edit-group', GroupEditHandler),
    ('/ajax/post-group', GroupPostHandler),
    ('/ajax/delete-post', DeletePostHandler),
    ('/ajax/edit-post', EditPostHandler),   
    ('/ajax/group-text-search', GroupTextSearchHandler),
    ('/generate-notifications/posts', NotificationWorkerHandler),
    ('/ajax/get-group-feed', GetGroupFeedHandler), 
    ('/ajax/update-group-feed', UpdateGroupFeedHandler),
    ('/ajax/check-post-notifications', CheckPostNotificationHandler),
    ('/ajax/get-post-notifications', GetPostNotificationsHandler),
    ('/ajax/get-request-notifications', RequestNotificationHandler),
    ('/ajax/update-request-notifications', UpdateRequestHandler), 
    ('/ajax/complete-request', CompleteRequestHandler),
    ('/ajax/delete-image', DeleteImageHandler),
    ('/ajax/upload-image', UploadImageHandler),
    ('/ajax/get-image-upload-url', GetImageUploadUrlHandler),
    ('/ajax/get-creating-account-url', CreatingAccountUrlHandler),  
    ('/ajax/widget/hot-groups', HotGroupsHandler),
    ('/datastore', DatastoreHandler)
], debug=True)   

