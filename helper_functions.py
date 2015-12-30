
import re
import datetime

from constants import GROUP_NAME_RE, DISPLAY_NAME_RE
from constants import SECONDS_IN_DAY, MAX_IMAGE_SIZE_BYTES
from constants import MAX_NOTIFICATIONS_FETCHED
from constants import DEFAULT_USER_IMAGE, DFAULT_GROUP_IMAGE

def get_thumbnail_url(url, size, image_type):
	IMAGE_RE = re.compile(r'.(jpg|png|jpeg)$')
	url_original = url
	if not url:
		if image_type == 'user':
			url = DEFAULT_USER_IMAGE
		if image_type == 'group':
			url = DFAULT_GROUP_IMAGE
    
    # only crop image if size is not 0
	# 0 size implies return the original image
	if size != 0:
		if url_original:
		    url = url + '=s' + str(size) + '-c'
		else:
		    #fix size for defaults
		    m = IMAGE_RE.search(url)
		    dot_index = m.span()[0]
		    url = url[:dot_index] + str(size) + url[dot_index:]
    
	return url

def check_group_name(name):
	if not GROUP_NAME_RE.match(name):
		raise BadUserInputError('Invalid Group name')
	else:
		return True

def sanitize_group_name(name):
    san_name = re.sub(r'[\s]{2,}', ' ', name).strip()
    return san_name
    
def get_group_id(name):
    id = name.replace(' ', '-').lower()
    return id

def check_display_name(name):
	if name.isspace():
		raise BadUserInputError('Invalid display name.')
		
	if name and not DISPLAY_NAME_RE.match(name):
		raise BadUserInputError('Invalid display name.')
	san_name = re.sub(r'[\s]{2,}', ' ', name).strip()
	return san_name

def check_uploaded_image(blob_info):
	# don't allow non images and gifs
	if 'image' not in blob_info.content_type or 'gif' in  blob_info.content_type:
		raise BadImageError('Not an image file.')

	if blob_info.size > MAX_IMAGE_SIZE_BYTES:
		raise BadImageError('Image size more than 10MB.')


def check_query_string(q):
	if not q or q.isspace() or not GROUP_NAME_RE.match(q):
		return False
	else:
		return True

def process_query_string(q):
	#split at space and get a list
	key_words = q.split()
	query_str_fixed = None

	if (len(key_words) > 1) and (len(key_words) < 3):
		#fix OR
		query_str_fixed = ' OR '.join(key_words)
	else:
		query_str_fixed = ' '.join(key_words)
	return query_str_fixed

def build_suggestions(str):
    suggestions = []
    for word in str.split():
        prefix = ""
        for letter in word:
            prefix += letter
            if len(prefix) >= 3:
                suggestions.append(prefix)
    return ' '.join(suggestions)

def delete_item(item_list, item_to_delete):
	# this removes duplicates
    return [item for item in item_list if item != item_to_delete]

def limit_notifications(list1, list2):
	# this is called before add_user_name_image function and hence takes
	# two equal length lists of data and user keys
	if len(list1) <= MAX_NOTIFICATIONS_FETCHED:
		return list1, list2

	list1 = list1[:MAX_NOTIFICATIONS_FETCHED]
	list2 = list2[:MAX_NOTIFICATIONS_FETCHED]

	return list1, list2

def get_post_timestamp(dt):
	now = datetime.datetime.utcnow()
	old = dt

	diff = (now - old)
	diff_seconds = int(diff.total_seconds())

	timestamp = None
	if diff_seconds < SECONDS_IN_DAY:

	    if diff_seconds <= 60:
	    	#if posted less than a minute ago
	    	timestamp = "a moment ago"

	    if diff_seconds > 60 and diff_seconds < 3600:
	    	#if posted less than an hour ago
	    	timestamp = (str(int(diff_seconds/60)) + ' min')

	    if diff_seconds >= 3600:
	    	#if posted less than an 24hrs ago
	    	timestamp = (str(int(diff_seconds/3600)) + ' hr')
	else:
		#posted more than a day before
		if now.year == old.year:
			timestamp = '{dt.day} {dt:%b}'.format(dt= old)
		else:
			#show year only if the post is year or older
			timestamp = '{dt.day} {dt:%b}, {dt:%Y}'.format(dt= old)
	return timestamp
	
################----ERROR CLASSES----################

class BadUserInputError(Exception):
	def __init__(self, value):
		self.value = value
	
	def __str__(self):
		return repr(self.value)

class EntityExistsError(Exception):
	def __init__(self, value):
		self.value = value
	
	def __str__(self):
		return repr(self.value)

class BadImageError(Exception):
	def __init__(self, value):
		self.value = value
	
	def __str__(self):
		return repr(self.value)
