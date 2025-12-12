Here's how I want to configure it. I want to create a folder called CaseFolderTemplate. The purpose of this folder is for it to be copied to the Base Workspace URL that exists in Settings. I want to create a folder called CaseFolderTemplate anytime a new case is created. If you look at our schema, you'll see that we have something called a case. If you look at our routing scheme, you'll see that when a user logs in, they are first redirected to cases. They are prompted to either enter or create a case. So when we create a case, there should be a new folder created under that Base Workspace path. And that case folder should be copied from the CaseFolderTemplate. We should also keep a record of the path of that newly created case folder in the case schema. And not only that, when a conversation is initiated, the agent's working directory should always be Base Workspace path plus the case folder. There should never be a temp folder created as a subfolder. No matter what the conversation is, the context should always be full workspace path plus the case path. That's going to be tricky.

So in the original framework, I had each agent working out of a root folder, but it was only one user at a time—there was me. And that agent would be booted with a settings file.

The trick now is that I might have two users working on the same case at the same time. Now granted... so this settings file would be like a booter for the agent to let the agent know like what the active task is or, you know, whatever—the active work session.

But again, that was made for one user on one folder. And in this case, there could be multiple sub-processes living in one folder. So I'm wondering like, how we can handle basically booting the agent, regardless of the user, with some sort of settings config.

Now, the reason... Now what I _could_ do, I could just use the original like temp folders. But the problem is, with the MCP config that we're using—or the MCP server—it will index whatever the current work directory is when we spawn the agent. And I don't want to be indexing every single workspace that is generated. I want to index the case _once_ , and that's it.

So, the working directory cannot... the working directory cannot change. It has to be the case. We can't keep spawning sub-folders. But we have to figure out how to boot each agent with its own instructions, basically."

---

**Key Technical Constraints Identified**

- **Goal:** Multi-user support on a single case simultaneously.
- **Restriction:** The working directory must remain the "Case Root" to prevent the MCP server from re-indexing the codebase for every new session.
- **Problem:** Each agent needs unique startup parameters (active task/session ID), but you can't use unique folders or the standard single `settings.json` approach to isolate them.
