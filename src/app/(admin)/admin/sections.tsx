import { Fragment } from "react";
import { AccountStatus, EventPromotionStatus, PlacementType, UserRole } from "@prisma/client";
import {
  createAdminUserAction,
  resolveReportAdminAction,
  reviewVerificationRequestAdminAction,
  savePromotedEventAction,
  updateAdminUserAction,
} from "./actions";
import {
  formatDateTime,
  formatDateTimeInput,
  getActiveGroups,
  getOpenReports,
  getPendingVerificationRequests,
  getPromotedEvents,
  getRecentAuditLogs,
  getUsersByTab,
  moderationOptionsForTarget,
  reportTargetCopy,
} from "./lib";

const adminRoleOptions = [UserRole.ADMIN, UserRole.SUPER_ADMIN];

export async function AdminUsersSection({
  tab,
  expandedUserId,
}: {
  tab: "members" | "operators";
  expandedUserId?: string;
}) {
  const users = await getUsersByTab(tab);
  const currentSection = tab === "operators" ? "operators" : "users";

  return (
    <section className="admin-surface p-6" data-testid="admin-users">
      <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
        <p className="lux-overline text-[#a99687]">User management</p>
        <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">{tab === "members" ? "Member accounts" : "Admin accounts"}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#bbaea1]">
          {tab === "members"
            ? "Review regular member accounts in a calmer directory view, then expand a row when you need to change status, role, or test-user labeling."
            : "Manage operational admin accounts separately and create new admin users with the role and access level you need."}
        </p>
      </div>

      {tab === "operators" ? (
        <form action={createAdminUserAction} className="admin-card mt-5 grid gap-4 text-sm shadow-sm" data-testid="admin-create-user-form">
          <div>
            <p className="text-base font-semibold tracking-tight text-[#fff4ea]">Create admin user</p>
            <p className="mt-2 text-sm leading-6 text-[#bbaea1]">Operational admin accounts sign directly into the admin shell and do not use the member-facing app.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[#d7c8bb]">Display name</span>
              <input className="admin-input" maxLength={80} name="displayName" required />
            </label>
            <label className="grid gap-2">
              <span className="text-[#d7c8bb]">Email</span>
              <input className="admin-input" name="email" required type="email" />
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-[#d7c8bb]">Temporary password</span>
              <input className="admin-input" minLength={8} name="password" required type="password" />
            </label>
            <label className="grid gap-2">
              <span className="text-[#d7c8bb]">Role</span>
              <select className="admin-select" defaultValue={UserRole.ADMIN} name="role">
                {adminRoleOptions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-[#d7c8bb]">Account status</span>
              <select className="admin-select" defaultValue={AccountStatus.ACTIVE} name="accountStatus">
                {Object.values(AccountStatus).map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-3 rounded-[1.15rem] border border-[rgba(90,76,66,0.38)] bg-[rgba(24,20,17,0.52)] px-4 py-3 text-sm text-[#d7c8bb]">
            <input aria-label="Test user" className="h-4 w-4 accent-[#c9a76e]" name="isTestUser" type="checkbox" />
            Mark this account as a test user
          </label>
          <div className="flex justify-end">
            <button className="admin-button-primary" type="submit">Create admin user</button>
          </div>
        </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[rgba(90,76,66,0.42)] bg-[rgba(20,16,14,0.46)]">
        <table className="admin-table min-w-full text-sm">
          <thead className="text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Test user</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-[#aa9788]" colSpan={8}>
                  No users in this section yet.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isExpanded = expandedUserId === user.id;
                const toggleHref = isExpanded ? `/admin/${currentSection}` : `/admin/${currentSection}?expanded=${user.id}`;

                return (
                  <Fragment key={user.id}>
                    <tr className="align-top" data-testid={`admin-user-row-${user.id}`}>
                      <td className="px-4 py-4 font-medium text-[#fff4ea]">{user.displayName}</td>
                      <td className="px-4 py-4 text-[#d7c8bb]">{user.email}</td>
                      <td className="px-4 py-4 text-[#d7c8bb]">{user.role}</td>
                      <td className="px-4 py-4 text-[#d7c8bb]">{user.accountStatus}</td>
                      <td className="px-4 py-4 text-[#d7c8bb]">{user.verificationStatus}</td>
                      <td className="px-4 py-4 text-[#d7c8bb]">{user.isTestUser ? "Yes" : "No"}</td>
                      <td className="px-4 py-4 text-[#aa9788]">{formatDateTime(user.createdAt)}</td>
                      <td className="px-4 py-4 text-right">
                        <a className="admin-button-secondary px-3 py-1.5 text-xs" data-testid={`admin-user-toggle-${user.id}`} href={toggleHref}>
                          {isExpanded ? "Hide details" : "View details"}
                        </a>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr data-testid={`admin-user-${user.id}`}>
                        <td className="bg-[rgba(24,20,17,0.72)] px-4 py-4" colSpan={8}>
                          <form action={updateAdminUserAction} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                            <input name="targetUserId" type="hidden" value={user.id} />
                            <input name="currentSection" type="hidden" value={currentSection} />
                            <label className="grid gap-2">
                              <span className="text-sm text-[#d7c8bb]">Account status</span>
                              <select className="admin-select" defaultValue={user.accountStatus} name="accountStatus">
                                {Object.values(AccountStatus).map((value) => (
                                  <option key={value} value={value}>{value}</option>
                                ))}
                              </select>
                            </label>
                            <label className="grid gap-2">
                              <span className="text-sm text-[#d7c8bb]">Role</span>
                              <select className="admin-select" defaultValue={user.role} name="role">
                                {Object.values(UserRole).map((value) => (
                                  <option key={value} value={value}>{value}</option>
                                ))}
                              </select>
                            </label>
                            <label className="grid gap-2">
                              <span className="text-sm text-[#d7c8bb]">Test user</span>
                              <span className="flex min-h-[54px] items-center gap-3 rounded-[1.15rem] border border-[rgba(90,76,66,0.38)] bg-[rgba(24,20,17,0.52)] px-4 py-3 text-[#fff4ea]">
                                <input aria-label="Test user" className="h-4 w-4 accent-[#c9a76e]" defaultChecked={user.isTestUser} name="isTestUser" type="checkbox" />
                                Mark as test user
                              </span>
                            </label>
                            <div className="flex justify-end">
                              <button className="admin-button-primary" type="submit">Save user</button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export async function AdminVerificationsSection() {
  const pendingVerificationRequests = await getPendingVerificationRequests();

  return (
    <section className="admin-surface p-6" data-testid="admin-verification">
      <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
        <p className="lux-overline text-[#a99687]">Verifications</p>
        <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Pending review queue</h2>
      </div>
      <div className="mt-5 space-y-3">
        {pendingVerificationRequests.length === 0 ? (
          <p className="admin-empty">No pending verification requests.</p>
        ) : (
          pendingVerificationRequests.map((request) => {
            const hasPrerequisites = Boolean(request.user.emailVerified && request.user.phoneVerifiedAt && request.user.ageVerified);

            return (
              <div key={request.id} className="admin-card text-sm shadow-sm" data-testid={`admin-verification-${request.userId}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{request.user.displayName}</p>
                    <p className="text-[#bbaea1]">{request.user.email}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8f7f72]">Submitted {formatDateTime(request.createdAt)}</p>
                  </div>
                  <span className={`admin-pill ${hasPrerequisites ? "!border-[rgba(184,197,166,0.28)] !bg-[rgba(184,197,166,0.12)] !text-[#dfe8d5]" : "!border-[rgba(201,167,110,0.28)] !bg-[rgba(201,167,110,0.12)] !text-[#f2ddbb]"}`}>
                    {hasPrerequisites ? "Ready to approve" : "Missing prerequisites"}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 text-xs text-[#bbaea1] sm:grid-cols-3">
                  <span className="rounded-[1rem] border border-[rgba(90,76,66,0.38)] px-3 py-2">Email: {request.user.emailVerified ? "Verified" : "Missing"}</span>
                  <span className="rounded-[1rem] border border-[rgba(90,76,66,0.38)] px-3 py-2">Phone: {request.user.phoneVerifiedAt ? "Verified" : "Missing"}</span>
                  <span className="rounded-[1rem] border border-[rgba(90,76,66,0.38)] px-3 py-2">18+: {request.user.ageVerified ? "Verified" : "Missing"}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={reviewVerificationRequestAdminAction}>
                    <input name="requestId" type="hidden" value={request.id} />
                    <input name="decision" type="hidden" value="approve" />
                    <button className="admin-button-primary disabled:opacity-50" disabled={!hasPrerequisites} type="submit">
                      Approve verification
                    </button>
                  </form>
                  <form action={reviewVerificationRequestAdminAction}>
                    <input name="requestId" type="hidden" value={request.id} />
                    <input name="decision" type="hidden" value="reject" />
                    <button className="admin-button-secondary" type="submit">
                      Reject verification
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export async function AdminReportsSection() {
  const openReports = await getOpenReports();

  return (
    <section className="admin-surface p-6" data-testid="admin-reports">
      <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
        <p className="lux-overline text-[#a99687]">Reports and moderation</p>
        <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Open reports</h2>
      </div>
      <div className="mt-5 space-y-3">
        {openReports.length === 0 ? (
          <p className="admin-empty">No open reports right now.</p>
        ) : (
          openReports.map((report) => {
            const moderationOptions = moderationOptionsForTarget(report.targetType);

            return (
              <form key={report.id} action={resolveReportAdminAction} className="admin-card text-sm shadow-sm" data-testid={`admin-report-${report.id}`}>
                <input name="reportId" type="hidden" value={report.id} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{report.targetType} report</p>
                    <p className="text-[#bbaea1]">Filed by {report.filedBy.displayName} ({report.filedBy.email})</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8f7f72]">Opened {formatDateTime(report.createdAt)}</p>
                  </div>
                  <span className="admin-pill">{report.reasonCode}</span>
                </div>
                <div className="mt-4 rounded-[1.2rem] border border-[rgba(90,76,66,0.38)] bg-[rgba(24,20,17,0.6)] p-4 text-sm text-[#e6d9cf]">
                  <p className="lux-overline text-[#8f7f72]">Target preview</p>
                  <p className="mt-3 whitespace-pre-wrap leading-6">{reportTargetCopy(report)}</p>
                  {report.details ? <p className="mt-3 text-[#bbaea1]">Reporter note: {report.details}</p> : null}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Moderation action</span>
                    <select className="admin-select" defaultValue={moderationOptions[0]?.value ?? "NONE"} name="moderationAction">
                      <option value="NONE">No direct moderation</option>
                      {moderationOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <button className="admin-button-primary" name="decision" type="submit" value="resolve">
                    Resolve report
                  </button>
                  <button className="admin-button-secondary" name="decision" type="submit" value="reject">
                    Reject report
                  </button>
                </div>
              </form>
            );
          })
        )}
      </div>
    </section>
  );
}

export async function AdminEventsSection() {
  const [promotedEvents, activeGroups] = await Promise.all([getPromotedEvents(), getActiveGroups()]);

  return (
    <section className="admin-surface p-6" data-testid="admin-events">
      <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
        <p className="lux-overline text-[#a99687]">Promoted events</p>
        <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Create and update placements</h2>
      </div>
      <form action={savePromotedEventAction} className="admin-card mt-5 grid gap-3 text-sm" data-testid="admin-event-create">
        <div>
          <p className="text-base font-semibold tracking-tight text-[#fff4ea]">Create promoted event</p>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#8f7f72]">Each event uses one primary placement in this MVP admin flow.</p>
        </div>
        <label className="grid gap-2">
          <span className="text-[#d7c8bb]">Title</span>
          <input className="admin-input" name="title" required />
        </label>
        <label className="grid gap-2">
          <span className="text-[#d7c8bb]">Description</span>
          <textarea className="admin-textarea min-h-20" name="description" />
        </label>
        <label className="grid gap-2">
          <span className="text-[#d7c8bb]">External link</span>
          <input className="admin-input" name="externalLink" placeholder="https://..." required />
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Coupon code</span>
            <input className="admin-input" name="couponCode" />
          </label>
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Image URL</span>
            <input className="admin-input" name="imageUrl" />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Status</span>
            <select className="admin-select" defaultValue={EventPromotionStatus.DRAFT} name="status">
              {Object.values(EventPromotionStatus).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Placement</span>
            <select className="admin-select" defaultValue={PlacementType.HOME_FEED_CARD} name="placementType">
              {Object.values(PlacementType).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Starts at</span>
            <input className="admin-input" name="startsAt" type="datetime-local" />
          </label>
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Ends at</span>
            <input className="admin-input" name="endsAt" type="datetime-local" />
          </label>
          <label className="grid gap-2">
            <span className="text-[#d7c8bb]">Priority</span>
            <input className="admin-input" defaultValue="0" name="priority" type="number" />
          </label>
        </div>
        <label className="grid gap-2">
          <span className="text-[#d7c8bb]">Group detail placement target</span>
          <select className="admin-select" defaultValue="" name="groupId">
            <option value="">No specific group</option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end">
          <button className="admin-button-primary" type="submit">Save event</button>
        </div>
      </form>

      <div className="mt-5 space-y-3">
        {promotedEvents.map((event) => {
          const placement = event.placements[0];
          return (
            <form key={event.id} action={savePromotedEventAction} className="admin-card text-sm shadow-sm" data-testid={`admin-event-${event.id}`}>
              <input name="eventPromotionId" type="hidden" value={event.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{event.title}</p>
                  <p className="mt-1 text-[#bbaea1]">{placement?.placementType ?? "No placement"}</p>
                </div>
                <span className="admin-pill">{event.status}</span>
              </div>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-[#d7c8bb]">Title</span>
                  <input className="admin-input" defaultValue={event.title} name="title" required />
                </label>
                <label className="grid gap-2">
                  <span className="text-[#d7c8bb]">Description</span>
                  <textarea className="admin-textarea min-h-20" defaultValue={event.description ?? ""} name="description" />
                </label>
                <label className="grid gap-2">
                  <span className="text-[#d7c8bb]">External link</span>
                  <input className="admin-input" defaultValue={event.externalLink} name="externalLink" required />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Status</span>
                    <select className="admin-select" defaultValue={event.status} name="status">
                      {Object.values(EventPromotionStatus).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Placement</span>
                    <select className="admin-select" defaultValue={placement?.placementType ?? PlacementType.HOME_FEED_CARD} name="placementType">
                      {Object.values(PlacementType).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Starts at</span>
                    <input className="admin-input" defaultValue={formatDateTimeInput(event.startsAt)} name="startsAt" type="datetime-local" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Ends at</span>
                    <input className="admin-input" defaultValue={formatDateTimeInput(event.endsAt)} name="endsAt" type="datetime-local" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Priority</span>
                    <input className="admin-input" defaultValue={String(placement?.priority ?? 0)} name="priority" type="number" />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Coupon code</span>
                    <input className="admin-input" defaultValue={event.couponCode ?? ""} name="couponCode" />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-[#d7c8bb]">Image URL</span>
                    <input className="admin-input" defaultValue={event.imageUrl ?? ""} name="imageUrl" />
                  </label>
                </div>
                <label className="grid gap-2">
                  <span className="text-[#d7c8bb]">Group detail placement target</span>
                  <select className="admin-select" defaultValue={placement?.groupId ?? ""} name="groupId">
                    <option value="">No specific group</option>
                    {activeGroups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </label>
                <div className="flex justify-between gap-3 text-xs uppercase tracking-[0.14em] text-[#8f7f72]">
                  <span>Starts {formatDateTime(event.startsAt)}</span>
                  <span>Ends {formatDateTime(event.endsAt)}</span>
                </div>
                <div className="flex justify-end">
                  <button className="admin-button-secondary" type="submit">Update event</button>
                </div>
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}

export async function AdminAuditLogsSection() {
  const recentAuditLogs = await getRecentAuditLogs();

  return (
    <section className="admin-surface p-6" data-testid="admin-audit-log">
      <div className="border-b border-[rgba(90,76,66,0.36)] pb-5">
        <p className="lux-overline text-[#a99687]">Audit log</p>
        <h2 className="mt-3 text-[1.85rem] font-semibold tracking-tight text-[#fff4ea]">Recent sensitive admin actions</h2>
      </div>
      <div className="mt-5 space-y-3">
        {recentAuditLogs.length === 0 ? (
          <p className="admin-empty">No audit entries yet.</p>
        ) : (
          recentAuditLogs.map((entry) => (
            <div key={entry.id} className="admin-card text-sm shadow-sm" data-testid={`audit-log-${entry.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight text-[#fff4ea]">{entry.action}</p>
                  <p className="text-[#bbaea1]">{entry.targetType} {entry.targetId ? `- ${entry.targetId}` : ""}</p>
                </div>
                <span className="text-xs uppercase tracking-[0.14em] text-[#8f7f72]">{formatDateTime(entry.createdAt)}</span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[#aa9788]">Actor {entry.actor?.email ?? "Unknown"}</p>
              {entry.metadataJson ? (
                <pre className="mt-3 overflow-x-auto rounded-[1.2rem] border border-[rgba(90,76,66,0.36)] bg-[rgba(24,20,17,0.6)] p-3 text-[11px] text-[#bbaea1]">
                  {JSON.stringify(entry.metadataJson, null, 2)}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
