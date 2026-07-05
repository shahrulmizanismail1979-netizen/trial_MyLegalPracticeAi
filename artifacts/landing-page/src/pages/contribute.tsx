import { useRef, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  X,
  ShieldCheck,
} from "lucide-react";
import { useCreateContribution } from "@workspace/api-client-react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const CATEGORIES = [
  "Litigation",
  "Syariah",
  "Corporate Secretary",
  "Conveyancing",
  "Criminal",
  "Corporate/Commercial/Banking",
  "Accident & Personal Injury",
  "General/Other",
] as const;

const contributeSchema = z.object({
  contributorName: z.string().min(1, "Your name is required"),
  contributorEmail: z.string().email("Enter a valid email"),
  contributorPhone: z.string().optional(),
  category: z.enum(CATEGORIES, {
    message: "Please choose a category",
  }),
  title: z.string().optional(),
  description: z.string().optional(),
});

type ContributeFormValues = z.infer<typeof contributeSchema>;

type FileStatus = "pending" | "uploading" | "done" | "error";

interface TrackedFile {
  file: File;
  status: FileStatus;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContributePage() {
  const isJudgment =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("type") === "judgment";
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile } = useUpload();
  const createContribution = useCreateContribution();

  const form = useForm<ContributeFormValues>({
    resolver: zodResolver(contributeSchema),
    defaultValues: {
      contributorName: "",
      contributorEmail: "",
      contributorPhone: "",
      title: isJudgment ? "Case Judgment" : "",
      description: "",
    },
  });

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList).map((file) => ({
      file,
      status: "pending" as FileStatus,
    }));
    setFiles((prev) => [...prev, ...incoming]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const setStatus = (index: number, status: FileStatus) => {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status } : f)),
    );
  };

  const onSubmit = async (values: ContributeFormValues) => {
    if (files.length === 0) {
      toast.error("Please attach at least one document");
      return;
    }

    setSubmitting(true);
    const titleBase = values.title?.trim();
    let successes = 0;

    for (let i = 0; i < files.length; i++) {
      const { file } = files[i];
      if (files[i].status === "done") {
        successes++;
        continue;
      }
      setStatus(i, "uploading");
      try {
        const uploaded = await uploadFile(file);
        if (!uploaded) throw new Error("Upload failed");

        await createContribution.mutateAsync({
          data: {
            title: titleBase ? `${titleBase} — ${file.name}` : file.name,
            description: values.description?.trim() || null,
            category: values.category,
            contributorName: values.contributorName,
            contributorEmail: values.contributorEmail,
            contributorPhone: values.contributorPhone?.trim() || null,
            fileName: file.name,
            objectPath: uploaded.objectPath,
            fileSize: file.size,
            contentType: file.type || "application/octet-stream",
          },
        });
        setStatus(i, "done");
        successes++;
      } catch {
        setStatus(i, "error");
      }
    }

    setSubmitting(false);

    if (successes === files.length) {
      setSubmittedCount(successes);
    } else if (successes > 0) {
      toast.warning(
        `${successes} of ${files.length} documents submitted. Please retry the failed ones.`,
      );
    } else {
      toast.error("Submission failed. Please try again.");
    }
  };

  if (submittedCount !== null) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center bg-card border border-border rounded-xl p-10 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-serif font-bold">Thank you for contributing</h1>
          <p className="text-muted-foreground mt-3">
            {submittedCount} document{submittedCount === 1 ? "" : "s"} received. Every
            contribution is reviewed by our team before it is adopted into the shared
            knowledge base.
          </p>
          <div className="flex gap-3 justify-center mt-8">
            <Button
              variant="outline"
              onClick={() => {
                setSubmittedCount(null);
                setFiles([]);
                form.reset();
              }}
            >
              Contribute more
            </Button>
            <Link href="/">
              <Button>Back to home</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>

        <div className="mb-10">
          <Badge variant="secondary" className="mb-4 font-mono uppercase tracking-wider">
            {isJudgment ? "Case Repository" : "Contribute"}
          </Badge>
          <h1 className="text-4xl font-serif font-bold">
            {isJudgment ? "Contribute a case judgment" : "Strengthen the corpus"}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl">
            {isJudgment
              ? "Share written judgments and grounds of judgment from cases handled in your own legal practice. They are stored in the shared case repository used by all AI Portals apps. Upload in any format — PDF, Word, scans, or archives. Text is extracted automatically where possible."
              : "Share soft-copy cause papers and legal documents to help every AI Portals app learn from real Malaysian legal practice. Upload documents in any format — PDF, Word, scans, or archives. Text is extracted automatically where possible."}
          </p>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3 mb-8">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Contributions are reviewed before being adopted into the knowledge base. Please
            only upload documents you are entitled to share.{" "}
            <span className="text-foreground font-medium">
              Every approved contribution earns you a voucher for 1 month free — once your
              contribution is approved, our team will send the voucher code to the email
              address you provide below.
            </span>
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contributorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane Advocate" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contributorEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@firm.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contributorPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="+60..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a practice area" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection title (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. High Court pleadings 2024"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Anything reviewers should know about these documents"
                      rows={3}
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Label className="mb-2 block">Documents</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-secondary/50 transition-colors"
              >
                <UploadCloud className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm font-medium">Click to select files</span>
                <span className="text-xs text-muted-foreground">
                  Any format · multiple files · large uploads supported
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />

              {files.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {files.map((tracked, index) => (
                    <li
                      key={`${tracked.file.name}-${index}`}
                      className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                    >
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{tracked.file.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatSize(tracked.file.size)}
                        </div>
                      </div>
                      {tracked.status === "uploading" && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                      {tracked.status === "done" && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {tracked.status === "error" && (
                        <Badge variant="destructive" className="text-[10px]">
                          Failed
                        </Badge>
                      )}
                      {!submitting && tracked.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                </>
              ) : (
                <>Submit contribution</>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </main>
  );
}
