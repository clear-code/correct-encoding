correct-encoding
================

Corrects encoding information of the active message when it has attachments with different encoding. This is a workaround for the bug 715823.

715823 – Forward message, wrong encoding (if different charset is used in part under multipart/mixed, charset of last part is used in forward/edit as new, without converting data to the charset)
https://bugzilla.mozilla.org/show_bug.cgi?id=715823

## How to test

### Confirmation of the problem

 1. Open the file samples/testcase.eml by Thunderbird.
 2. Try to forward it.
 3. You'll see a broken body for the forwarded message.

### Confirmation that this addon works

 1. Install this addon.
 2. Open the file samples/testcase.eml by Thunderbird.
 3. Try to forward it.
 4. You'll see a correct body for the forwarded message.
