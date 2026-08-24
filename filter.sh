FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --index-filter 'git rm --cached --ignore-unmatch -r "Sample Music Folder"' --prune-empty --tag-name-filter cat -- --all
