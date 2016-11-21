import webapp2

from google.appengine.api import users
from google.appengine.ext import ndb
from google.appengine.api import search
from google.appengine.api import memcache
from google.appengine.ext import blobstore
from google.appengine.api import images

from utility_handler import Handler

from models import *

from helper_functions import BadUserInputError, BadImageError
from helper_operations import search_index

class AdminPageHandler(Handler):

    def get(self):
        if not self.user:
            return self.redirect('/')

        self.render('admin.html')

class HardResetHandler(Handler):

    def get(self):
        if not self.user:
            return self.redirect('/')

        ## CLEAR DATASTORE

        datastore_keys = []
        datastore_keys.extend(User.query().fetch(keys_only=True))
        datastore_keys.extend(Group.query().fetch(keys_only=True))
        datastore_keys.extend(GroupPost.query().fetch(keys_only=True))
        datastore_keys.extend(PrivateRequest.query().fetch(keys_only=True))

        if len(datastore_keys) > 0:
            ndb.delete_multi(datastore_keys)


        ## CLEAR BLOBSTORE

        blobinfo_objects_query = blobstore.BlobInfo.all()
        blobinfo_objects = blobinfo_objects_query.fetch(400)
        if len(blobinfo_objects) > 0:
            for blobinfo_obj in blobinfo_objects:
                blob_key = blobinfo_obj.key()

                #remove image serving url
                images.delete_serving_url(blob_key)
                #remove blob
                blobstore.delete([blob_key])

        
        ## CLEAR DOCUMENTS IN SEARCH INDEX(groups)
        ## from delete_all_in_index function at https://cloud.google.com/appengine/docs/python/search/
        
        group_index = search.Index(name='groups')
        # index.get_range by returns up to 100 documents at a time, so we must
        # loop until we've deleted all items.
        while True:
            # Use ids_only to get the list of document IDs in the index without
            # the overhead of getting the entire document.
            document_ids = [
            document.doc_id
            for document
            in group_index.get_range(ids_only=True)]

            # If no IDs were returned, we've deleted everything.
            if not document_ids:
                break

            # Delete the documents for the given IDs
            group_index.delete(document_ids)


        ## CLEAR MEMCACHE
        memcache.flush_all()

        return self.render_json("Hard Reset Success")
       

app = webapp2.WSGIApplication([
    (r'/admin/?', AdminPageHandler),
    ('/admin/ajax/hard-reset', HardResetHandler)
], debug=True)   

