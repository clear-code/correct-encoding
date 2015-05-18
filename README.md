correct-encoding
================

Corrects encoding information of the active message when it has attachments with different encoding. This is a workaround for the bug 715823.

715823 – Forward message, wrong encoding (if different charset is used in part under multipart/mixed, charset of last part is used in forward/edit as new, without converting data to the charset)
https://bugzilla.mozilla.org/show_bug.cgi?id=715823
