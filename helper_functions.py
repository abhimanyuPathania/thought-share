
import re

GROUP_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{3,20}$")
DISPLAY_NAME_RE = re.compile(r"^[a-zA-Z0-9\s]{2,20}$")

def check_group_name(name):
	if not GROUP_NAME_RE.match(name):
		raise BadUserInputError('Invalid Group name')
	else:
		return True

def sanitize_group_name(name):
    san_name = re.sub(r'[\s]{2,}', ' ', name).strip(' ')
    return san_name
    
def get_group_id(name):
    id = name.replace(' ', '-').lower()
    return id

def check_display_name(name):
	if name and not DISPLAY_NAME_RE.match(name):
		raise BadUserInputError('Invalid display name')
	san_name = re.sub(r'[\s]{2,}', ' ', name).strip(' ')
	return san_name

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
