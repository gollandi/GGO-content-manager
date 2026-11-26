/**
 * The guide for the social media manager — what it shows, what each button
 * does, and what stays with JJ. Static: nothing here reads or writes data.
 */
export const metadata = { title: "Guide — GGO Med cockpit" };

const section = "paper mb-5 border border-paper-edge p-5 text-[14px] leading-relaxed text-paper-foreground";
const h2 = "column-label column-label-paper mb-2";

export default function GuidePage() {
    return (
        <div className="mx-auto max-w-2xl p-8 max-sm:p-4">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Guide</h1>
                    <p className="page-subtitle">How the GGO Med social work flows through this cockpit.</p>
                </div>
            </header>

            <section className={section}>
                <h2 className={h2}>How the work moves</h2>
                <ol className="list-decimal space-y-1 pl-5">
                    <li>The house&apos;s agents plan and produce each post: visuals, caption and hashtags.</li>
                    <li>When a post is ready to be judged it enters <strong>Review</strong> and appears in your <a className="underline" href="/review">Social queue</a>.</li>
                    <li>You check it, and either mark it <strong>Ready for JJ</strong>, add a note, or <strong>request changes</strong>.</li>
                    <li>JJ decides: he approves — and <strong>approving is publishing</strong>, his approval hands the post to Buffer, which posts it at its slot — or he sends it back to the team, usually with your note.</li>
                </ol>
            </section>

            <section className={section}>
                <h2 className={h2}>The three buttons</h2>
                <dl className="space-y-3">
                    <div>
                        <dt className="font-semibold">Ready for JJ</dt>
                        <dd>You have checked the post and think it can go. Add a short note if anything is worth his attention. JJ sees &ldquo;Checked by&rdquo; with your name and the time. It does not publish anything.</dd>
                    </div>
                    <div>
                        <dt className="font-semibold">Add note</dt>
                        <dd>Leaves a remark in the post&apos;s history without changing its status — a question, a suggestion, a fact to verify.</dd>
                    </div>
                    <div>
                        <dt className="font-semibold">Request changes</dt>
                        <dd>The post needs work. Write what should change (a note is required). JJ sees &ldquo;Changes requested&rdquo; with your name on the post and sends it back to the team; the post stays in the queue until he does.</dd>
                    </div>
                </dl>
            </section>

            <section className={section}>
                <h2 className={h2}>What stays with JJ</h2>
                <p>Approving, scheduling or sending to Buffer, sending a post back, rejecting, closing and deleting posts, and changing a publish date are JJ&apos;s alone. You act on posts in Review — the ones in your queue. The buttons for them are not shown to you, and the server refuses them if asked. This is deliberate: GGO Med is a medical practice, and nothing reaches the public without the clinician&apos;s approval.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Notes are a shared history</h2>
                <p>Every note is added to the post with the date, time and the author&apos;s name, on one line, and nothing is ever overwritten. The field is shared and short (1,600 characters for people, the rest kept for the agents), so keep notes brief. Write as you would on a shared document: clear, specific, kind. Notes are written in British English, as is everything GGO Med publishes.</p>
                <p className="mt-2">Square brackets are turned into round ones: the agents use bracketed markers in the same field.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Uploading media</h2>
                <p><a className="underline" href="/carico">Upload media</a> takes video and audio (MP4, MOV, M4V, WebM, MKV, AVI, M4A, MP3, WAV), straight from your phone if you like. Large files go up in pieces and resume if the signal drops: press <em>Resume</em>. The team&apos;s worker prepares the footage for editing. You can cancel only your own uploads.</p>
                <p className="mt-2">Never upload anything that shows or identifies a patient.</p>
            </section>

            <section className={section}>
                <h2 className={h2}>Your account</h2>
                <ul className="list-disc space-y-1 pl-5">
                    <li>Your password is yours: no one else knows it. If you forget it, ask JJ for a new link.</li>
                    <li>After several wrong passwords, sign-in pauses for fifteen minutes.</li>
                    <li>Everything you do here is recorded with your name.</li>
                </ul>
            </section>
        </div>
    );
}
