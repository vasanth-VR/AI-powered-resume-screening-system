// ============================================
// AI RESUME SCREENING SYSTEM - FRONTEND JS
// ============================================

const API_URL = "http://127.0.0.1:8000";

let selectedFile = null;
let jobs = [];
let screeningResults = [];
let currentResult = null;


// ============================================
// INITIALIZE APPLICATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
    initializeApp();
});

async function initializeApp() {
    setupUpload();
    setupNavigation();
    setupButtons();
    setupSearch();
    setupCandidateActions();
    setupDarkMode();

    await loadJobs();
    await checkBackend();

    loadSessionData();
    renderCandidateTable();
    updateSessionStats();
}


// ============================================
// UPLOAD SYSTEM
// ============================================

function setupUpload() {
    const uploadArea = document.getElementById("uploadArea");
    const resumeInput = document.getElementById("resumeInput");
    const browseBtn = document.getElementById("browseBtn");
    const clearFile = document.getElementById("clearFile");

    if (!uploadArea || !resumeInput) return;

    browseBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        resumeInput.click();
    });

    uploadArea.addEventListener("click", (event) => {
        if (
            event.target !== browseBtn &&
            !event.target.closest("#browseBtn") &&
            !event.target.closest("#clearFile")
        ) {
            resumeInput.click();
        }
    });

    resumeInput.addEventListener("change", (event) => {
        const file = event.target.files[0];

        if (file) {
            handleSelectedFile(file);
        }
    });

    uploadArea.addEventListener("dragover", (event) => {
        event.preventDefault();
        uploadArea.classList.add("drag-over");
    });

    uploadArea.addEventListener("dragleave", () => {
        uploadArea.classList.remove("drag-over");
    });

    uploadArea.addEventListener("drop", (event) => {
        event.preventDefault();
        uploadArea.classList.remove("drag-over");

        const file = event.dataTransfer.files[0];

        if (file) {
            handleSelectedFile(file);
        }
    });

    clearFile?.addEventListener("click", (event) => {
        event.stopPropagation();
        clearSelectedFile();
    });
}


function handleSelectedFile(file) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
        showToast("Please upload a PDF resume.", "error");
        return;
    }

    selectedFile = file;

    const fileName = document.getElementById("fileName");

    if (fileName) {
        fileName.innerHTML = `
            <span>${escapeHTML(file.name)}</span>
        `;
    }

    const uploadArea = document.getElementById("uploadArea");

    if (uploadArea) {
        uploadArea.classList.add("has-file");
    }

    showToast("Resume selected successfully.", "success");
}


function clearSelectedFile() {
    selectedFile = null;

    const resumeInput = document.getElementById("resumeInput");
    const fileName = document.getElementById("fileName");
    const uploadArea = document.getElementById("uploadArea");

    if (resumeInput) {
        resumeInput.value = "";
    }

    if (fileName) {
        fileName.innerHTML = "No file selected";
    }

    if (uploadArea) {
        uploadArea.classList.remove("has-file");
    }
}


// ============================================
// LOAD JOBS
// ============================================

async function loadJobs() {
    const jobSelect = document.getElementById("jobSelect");

    try {
        const response = await fetch(`${API_URL}/jobs`);

        if (!response.ok) {
            throw new Error("Unable to load jobs");
        }

        const data = await response.json();

        jobs = data.jobs || [];

        if (!jobSelect) return;

        jobSelect.innerHTML = `
            <option value="">Select a job</option>
        `;

        jobs.forEach((job) => {
            const option = document.createElement("option");

            option.value = job.job_id;
            option.textContent = job.title;

            jobSelect.appendChild(option);
        });

        jobSelect.addEventListener("change", () => {
            const selectedJob = jobs.find(
                (job) => job.job_id === jobSelect.value
            );

            const description =
                document.getElementById("jobDescription");

            if (description && selectedJob) {
                description.value = selectedJob.description;
            }
        });

    } catch (error) {
        console.error("Job loading error:", error);

        showToast(
            "Could not load jobs. Make sure the backend is running.",
            "error"
        );
    }
}


// ============================================
// SCREEN RESUME
// ============================================

async function screenResume() {
    if (!selectedFile) {
        showToast("Please upload a resume first.", "warning");
        return;
    }

    const jobSelect = document.getElementById("jobSelect");

    if (!jobSelect || !jobSelect.value) {
        showToast("Please select a job.", "warning");
        return;
    }

    const formData = new FormData();

    formData.append("resume", selectedFile);
    formData.append("job_id", jobSelect.value);

    setLoadingState(true);

    try {
        const response = await fetch(
            `${API_URL}/screen-resume`,
            {
                method: "POST",
                body: formData
            }
        );

        const data = await response.json();

        console.log("Screening response:", data);

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Resume screening failed"
            );
        }

        data.job_id = jobSelect.value;
        data.job_title = jobs.find((job) => job.job_id === jobSelect.value)?.title || "Candidate";

        currentResult = data;

        screeningResults.push(data);

        saveSessionData();

        displayScreeningResult(data);

        addCandidateToTable(data);

        updateSessionStats();

        if (data.ai_analysis) {
            showToast(
                "AI resume analysis completed successfully.",
                "success"
            );
        } else if (data.ai_error) {
            showToast(
                "Resume screened, but AI analysis is temporarily unavailable.",
                "warning"
            );
        } else {
            showToast(
                "Resume screened successfully.",
                "success"
            );
        }

    } catch (error) {
        console.error("Screening error:", error);

        showToast(
            error.message || "Unable to screen resume.",
            "error"
        );

    } finally {
        setLoadingState(false);
    }
}


// ============================================
// DISPLAY SCREENING RESULT
// ============================================

function displayScreeningResult(data) {
    const emptyResult = document.getElementById("emptyResult");
    const resultContent = document.getElementById("resultContent");

    if (emptyResult) {
        emptyResult.style.display = "none";
    }

    if (resultContent) {
        resultContent.style.display = "block";
    }

    const displayScore = getBestScore(data);

    const scoreElement = document.getElementById("score");

    if (scoreElement) {
        scoreElement.textContent = `${displayScore}%`;
    }

    const scoreRing = document.getElementById("scoreRing");

    if (scoreRing) {
        scoreRing.style.setProperty(
            "--score",
            `${displayScore}%`
        );
    }

    const scoreTitle = document.getElementById("scoreTitle");

    if (scoreTitle) {
        scoreTitle.textContent =
            getScoreTitle(displayScore);
    }

    const scoreDescription =
        document.getElementById("scoreDescription");

    if (scoreDescription) {
        if (data.ai_analysis?.summary) {
            scoreDescription.textContent =
                data.ai_analysis.summary;
        } else {
            scoreDescription.textContent =
                getScoreDescription(displayScore);
        }
    }

    const candidateName =
        document.getElementById("candidateName");

    if (candidateName) {
        candidateName.textContent =
            getCandidateName(data.filename);
    }

    const candidateRole =
        document.getElementById("candidateRole");

    if (candidateRole) {
        const jobSelect =
            document.getElementById("jobSelect");

        const selectedJob =
            jobs.find(
                (job) => job.job_id === jobSelect?.value
            );

        candidateRole.textContent =
            selectedJob?.title || "Candidate";
    }

    const candidateAvatar =
        document.getElementById("candidateAvatar");

    if (candidateAvatar) {
        candidateAvatar.textContent =
            getCandidateInitials(data.filename);
    }

    const resultFile =
        document.getElementById("resultFile");

    if (resultFile) {
        resultFile.textContent =
            data.filename || "Resume";
    }

    const requiredCount =
        document.getElementById("requiredCount");

    if (requiredCount) {
        requiredCount.textContent =
            data.required_skills?.length || 0;
    }

    displaySkills(
        "matchedSkills",
        data.matched_skills || [],
        "matched"
    );

    displaySkills(
        "missingSkills",
        data.missing_skills || [],
        "missing"
    );

    setResultStatus(displayScore);

    // Show AI analysis
    displayAIAnalysis(data);
}


// ============================================
// AI ANALYSIS DISPLAY
// ============================================

function displayAIAnalysis(data) {
    const resultContent =
        document.getElementById("resultContent");

    if (!resultContent) return;

    let panel =
        document.getElementById("aiAnalysisPanel");

    if (!panel) {
        panel = document.createElement("div");

        panel.id = "aiAnalysisPanel";

        panel.style.marginTop = "24px";
        panel.style.padding = "20px";
        panel.style.borderRadius = "12px";
        panel.style.border = "1px solid #ddd";
        panel.style.background = "var(--card-bg, #ffffff)";

        resultContent.appendChild(panel);
    }

    const ai = data.ai_analysis;

    if (!ai) {
        panel.innerHTML = `
            <h3>AI Analysis</h3>

            <p>
                AI analysis is currently unavailable.
            </p>

            <p>
                The system has displayed the
                rule-based skill matching result instead.
            </p>

            ${
                data.ai_error
                    ? `
                        <small>
                            ${escapeHTML(data.ai_error)}
                        </small>
                    `
                    : ""
            }
        `;

        return;
    }

    const aiScore = Number(ai.match_score);

    const suitable =
        ai.suitable === true
            ? "Suitable"
            : ai.suitable === false
                ? "Not Suitable"
                : "Needs Review";

    const strengths = Array.isArray(ai.strengths)
        ? ai.strengths
        : [];

    const missingSkills = Array.isArray(ai.missing_skills)
        ? ai.missing_skills
        : [];

    const recommendations =
        Array.isArray(ai.recommendations)
            ? ai.recommendations
            : [];

    panel.innerHTML = `
        <h3 style="margin-bottom:16px;">
            AI Resume Analysis
        </h3>

        <div style="margin-bottom:16px;">
            <strong>AI Match Score:</strong>
            <span style="font-size:20px;font-weight:bold;">
                ${
                    Number.isFinite(aiScore)
                        ? aiScore + "%"
                        : "N/A"
                }
            </span>
        </div>

        <div style="margin-bottom:16px;">
            <strong>Recommendation:</strong>
            <span>${escapeHTML(suitable)}</span>
        </div>

        ${
            ai.summary
                ? `
                    <div style="margin-bottom:16px;">
                        <strong>AI Summary</strong>
                        <p>
                            ${escapeHTML(ai.summary)}
                        </p>
                    </div>
                `
                : ""
        }

        ${
            strengths.length > 0
                ? `
                    <div style="margin-bottom:16px;">
                        <strong>Strengths</strong>

                        <ul>
                            ${strengths
                                .map(
                                    (item) =>
                                        `<li>${escapeHTML(
                                            item
                                        )}</li>`
                                )
                                .join("")}
                        </ul>
                    </div>
                `
                : ""
        }

        ${
            missingSkills.length > 0
                ? `
                    <div style="margin-bottom:16px;">
                        <strong>AI Identified Missing Skills</strong>

                        <ul>
                            ${missingSkills
                                .map(
                                    (item) =>
                                        `<li>${escapeHTML(
                                            item
                                        )}</li>`
                                )
                                .join("")}
                        </ul>
                    </div>
                `
                : ""
        }

        ${
            recommendations.length > 0
                ? `
                    <div>
                        <strong>Recommendations</strong>

                        <ul>
                            ${recommendations
                                .map(
                                    (item) =>
                                        `<li>${escapeHTML(
                                            item
                                        )}</li>`
                                )
                                .join("")}
                        </ul>
                    </div>
                `
                : ""
        }

        <hr style="margin:20px 0;">

        <small>
            Rule-based skill score:
            ${data.match_score ?? 0}%
        </small>
    `;
}


// ============================================
// SKILLS
// ============================================

function displaySkills(elementId, skills, type) {
    const container =
        document.getElementById(elementId);

    if (!container) return;

    container.innerHTML = "";

    if (!skills || skills.length === 0) {
        container.innerHTML = `
            <span class="skill-empty">
                None
            </span>
        `;

        return;
    }

    skills.forEach((skill) => {
        const span = document.createElement("span");

        span.className =
            `skill-tag ${type || ""}`;

        span.textContent = skill;

        container.appendChild(span);
    });
}


// ============================================
// SCORE HELPERS
// ============================================

function getBestScore(data) {
    const aiScore =
        Number(data?.ai_analysis?.match_score);

    if (
        Number.isFinite(aiScore) &&
        aiScore >= 0 &&
        aiScore <= 100
    ) {
        return Math.round(aiScore);
    }

    const normalScore =
        Number(data?.match_score);

    if (
        Number.isFinite(normalScore)
    ) {
        return Math.round(
            Math.max(
                0,
                Math.min(100, normalScore)
            )
        );
    }

    return 0;
}


function getScoreTitle(score) {
    if (score >= 80) {
        return "Excellent Match";
    }

    if (score >= 60) {
        return "Good Match";
    }

    if (score >= 40) {
        return "Moderate Match";
    }

    return "Low Match";
}


function getScoreDescription(score) {
    if (score >= 80) {
        return "The candidate strongly matches the selected job.";
    }

    if (score >= 60) {
        return "The candidate has a good match with the selected job.";
    }

    if (score >= 40) {
        return "The candidate has a moderate match with the selected job.";
    }

    return "The candidate has a low match with the selected job.";
}


function setResultStatus(score) {
    const scoreTitle =
        document.getElementById("scoreTitle");

    if (!scoreTitle) return;

    scoreTitle.classList.remove(
        "excellent",
        "good",
        "moderate",
        "low"
    );

    if (score >= 80) {
        scoreTitle.classList.add("excellent");
    } else if (score >= 60) {
        scoreTitle.classList.add("good");
    } else if (score >= 40) {
        scoreTitle.classList.add("moderate");
    } else {
        scoreTitle.classList.add("low");
    }
}


// ============================================
// CANDIDATE TABLE
// ============================================

function getCandidateJobTitle(data) {
    if (data.job_title) return data.job_title;

    if (data.job_id) {
        const job = jobs.find((item) => item.job_id === data.job_id);
        if (job?.title) return job.title;
    }

    return "Candidate";
}


function addCandidateToTable(data, resultIndex = screeningResults.indexOf(data)) {
    const table = document.getElementById("candidateTable");
    const emptyRow = document.getElementById("candidateEmptyRow");

    if (!table) return;

    if (emptyRow) {
        emptyRow.style.display = "none";
    }

    const score = getBestScore(data);
    const matchedSkills = data.matched_skills || [];
    const status = data.ai_analysis ? "AI Analyzed" : "Rule Based";

    const skillsHTML = matchedSkills.length
        ? matchedSkills.map((skill) =>
            `<span class="table-skill">${escapeHTML(skill)}</span>`
        ).join("")
        : `<span class="table-skill none">None</span>`;

    const row = document.createElement("tr");
    row.dataset.resultIndex = resultIndex;

    row.innerHTML = `
        <td>
            <div class="table-person">
                <div class="small-avatar">
                    ${escapeHTML(getCandidateInitials(data.filename))}
                </div>
                <div>
                    <strong>${escapeHTML(getCandidateName(data.filename))}</strong>
                    <span>${escapeHTML(data.filename || "Resume")}</span>
                </div>
            </div>
        </td>

        <td>
            ${escapeHTML(getCandidateJobTitle(data))}
        </td>

        <td class="score-cell">
            <div class="score-bar">
                <span style="width: ${Math.max(0, Math.min(100, score))}%"></span>
            </div>
            <strong>${score}%</strong>
        </td>

        <td>
            <div class="table-skills">
                ${skillsHTML}
            </div>
        </td>

        <td>
            <span class="badge ${data.ai_analysis ? "success" : "neutral"}">
                ${status}
            </span>
        </td>

        <td>
            <button
                type="button"
                class="table-action"
                data-action="view-candidate"
                data-result-index="${resultIndex}">
                View
            </button>
        </td>
    `;

    table.appendChild(row);
}


function renderCandidateTable() {
    const table = document.getElementById("candidateTable");
    if (!table) return;

    table.querySelectorAll("tr:not(#candidateEmptyRow)").forEach((row) => row.remove());

    if (!screeningResults.length) {
        const emptyRow = document.getElementById("candidateEmptyRow");
        if (emptyRow) emptyRow.style.display = "";
        return;
    }

    screeningResults.forEach((result, index) => {
        addCandidateToTable(result, index);
    });
}


function setupCandidateActions() {
    const table = document.getElementById("candidateTable");
    if (!table) return;

    table.addEventListener("click", (event) => {
        const button = event.target.closest('[data-action="view-candidate"]');
        if (!button) return;

        const index = Number(button.dataset.resultIndex);
        const result = screeningResults[index];

        if (!result) {
            showToast("Candidate result could not be found.", "error");
            return;
        }

        currentResult = result;
        displayScreeningResult(result);

        document.getElementById("screening")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
}

// ============================================
// SESSION STATISTICS
// ============================================

function updateSessionStats() {
    const totalResumes =
        document.getElementById("totalResumes");

    const shortlisted =
        document.getElementById("shortlisted");

    const pendingReview =
        document.getElementById("pendingReview");

    const averageMatch =
        document.getElementById("averageMatch");

    const validResults =
        screeningResults.filter(
            (result) => result
        );

    const total =
        validResults.length;

    const scores =
        validResults.map(
            (result) => getBestScore(result)
        );

    const average =
        scores.length
            ? Math.round(
                scores.reduce(
                    (sum, score) =>
                        sum + score,
                    0
                ) / scores.length
            )
            : 0;

    const selected =
        scores.filter(
            (score) => score >= 70
        ).length;

    const pending =
        scores.filter(
            (score) =>
                score >= 40 &&
                score < 70
        ).length;

    if (totalResumes) {
        totalResumes.textContent = total;
    }

    if (shortlisted) {
        shortlisted.textContent = selected;
    }

    if (pendingReview) {
        pendingReview.textContent = pending;
    }

    if (averageMatch) {
        averageMatch.textContent =
            `${average}%`;
    }
}


// ============================================
// BUTTONS
// ============================================

function setupButtons() {
    const screenBtn =
        document.getElementById("screenBtn");

    const resetBtn =
        document.getElementById("clearBtn") ||
        document.getElementById("resetBtn");

    const reportBtn =
        document.getElementById("reportBtn");

    const reportPageBtn =
        document.getElementById("reportPageBtn");

    screenBtn?.addEventListener(
        "click",
        screenResume
    );

    resetBtn?.addEventListener(
        "click",
        clearScreening
    );

    reportBtn?.addEventListener(
        "click",
        downloadResult
    );

    reportPageBtn?.addEventListener(
        "click",
        printReport
    );
}


// ============================================
// RESET
// ============================================

function clearScreening() {
    selectedFile = null;
    currentResult = null;

    const resumeInput =
        document.getElementById("resumeInput");

    const fileName =
        document.getElementById("fileName");

    const uploadArea =
        document.getElementById("uploadArea");

    const emptyResult =
        document.getElementById("emptyResult");

    const resultContent =
        document.getElementById("resultContent");

    const jobSelect =
        document.getElementById("jobSelect");

    const jobDescription =
        document.getElementById("jobDescription");

    if (resumeInput) {
        resumeInput.value = "";
    }

    if (fileName) {
        fileName.innerHTML =
            "No file selected";
    }

    if (uploadArea) {
        uploadArea.classList.remove(
            "has-file"
        );
    }

    if (jobSelect) {
        jobSelect.value = "";
    }

    if (jobDescription) {
        jobDescription.value = "";
    }

    if (emptyResult) {
        emptyResult.style.display =
            "block";
    }

    if (resultContent) {
        resultContent.style.display =
            "none";
    }

    const aiPanel =
        document.getElementById(
            "aiAnalysisPanel"
        );

    aiPanel?.remove();

    showToast(
        "Screening form has been reset.",
        "success"
    );
}


// ============================================
// BACKEND CONNECTION
// ============================================

async function checkBackend() {
    const apiStatus =
        document.getElementById("apiStatus");

    const backendStatusText =
        document.getElementById(
            "backendStatusText"
        );

    const backendSystemText =
        document.getElementById(
            "backendSystemText"
        );

    const sidebarBackendStatus =
        document.getElementById(
            "sidebarBackendStatus"
        );

    const connectionBadge =
        document.getElementById(
            "connectionBadge"
        );

    try {
        const response =
            await fetch(
                `${API_URL}/health`
            );

        if (!response.ok) {
            throw new Error(
                "Backend unavailable"
            );
        }

        if (apiStatus) {
            apiStatus.textContent =
                "Connected";
        }

        if (backendStatusText) {
            backendStatusText.textContent =
                "Connected";
        }

        if (backendSystemText) {
            backendSystemText.textContent =
                "Online";
        }

        if (sidebarBackendStatus) {
            sidebarBackendStatus.textContent =
                "Online";
        }

        if (connectionBadge) {
            connectionBadge.textContent =
                "Connected";
        }

    } catch (error) {
        console.error(error);

        if (apiStatus) {
            apiStatus.textContent =
                "Disconnected";
        }

        if (backendStatusText) {
            backendStatusText.textContent =
                "Disconnected";
        }

        if (backendSystemText) {
            backendSystemText.textContent =
                "Offline";
        }

        if (sidebarBackendStatus) {
            sidebarBackendStatus.textContent =
                "Offline";
        }

        if (connectionBadge) {
            connectionBadge.textContent =
                "Disconnected";
        }
    }
}


// ============================================
// NAVIGATION
// ============================================

function setupNavigation() {
    const menuBtn =
        document.getElementById("menuBtn");

    const sidebarClose =
        document.getElementById(
            "sidebarClose"
        );

    const mobileOverlay =
        document.getElementById(
            "mobileOverlay"
        );

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    menuBtn?.addEventListener(
        "click",
        () => {
            sidebar?.classList.add(
                "open"
            );

            mobileOverlay?.classList.add(
                "show"
            );
        }
    );

    sidebarClose?.addEventListener(
        "click",
        closeSidebar
    );

    mobileOverlay?.addEventListener(
        "click",
        closeSidebar
    );
}


function closeSidebar() {
    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const mobileOverlay =
        document.getElementById(
            "mobileOverlay"
        );

    sidebar?.classList.remove(
        "open"
    );

    mobileOverlay?.classList.remove(
        "show"
    );
}


// ============================================
// DARK MODE
// ============================================

function setupDarkMode() {
    const darkModeBtn = document.getElementById("darkModeBtn");
    const themeIcon = document.getElementById("themeIcon");
    const themeText = document.getElementById("themeText");

    if (!darkModeBtn) return;

    const savedTheme = localStorage.getItem("resumeTheme");
    const isDark = savedTheme === "dark";

    document.body.classList.toggle("dark-mode", isDark);

    if (themeIcon) {
        themeIcon.textContent = isDark ? "☀️" : "🌙";
    }

    if (themeText) {
        themeText.textContent = isDark ? "Light Mode" : "Dark Mode";
    }

    darkModeBtn.addEventListener("click", () => {
        const dark = document.body.classList.toggle("dark-mode");

        localStorage.setItem("resumeTheme", dark ? "dark" : "light");

        if (themeIcon) {
            themeIcon.textContent = dark ? "☀️" : "🌙";
        }

        if (themeText) {
            themeText.textContent = dark ? "Light Mode" : "Dark Mode";
        }
    });
}


// ============================================
// SEARCH
// ============================================

function setupSearch() {
    const search =
        document.getElementById(
            "candidateSearch"
        );

    if (!search) return;

    search.addEventListener(
        "input",
        () => {
            const value =
                search.value
                    .toLowerCase()
                    .trim();

            const table =
                document.getElementById(
                    "candidateTable"
                );

            if (!table) return;

            const rows =
                table.querySelectorAll(
                    "tr"
                );

            rows.forEach((row) => {
                const text =
                    row.textContent
                        .toLowerCase();

                if (
                    row.id ===
                    "candidateEmptyRow"
                ) {
                    return;
                }

                row.style.display =
                    text.includes(value)
                        ? ""
                        : "none";
            });
        }
    );
}


// ============================================
// LOADING STATE
// ============================================

function setLoadingState(isLoading) {
    const screenBtn =
        document.getElementById(
            "screenBtn"
        );

    if (!screenBtn) return;

    if (isLoading) {
        screenBtn.disabled = true;

        screenBtn.dataset.originalText =
            screenBtn.textContent;

        screenBtn.textContent =
            "AI Screening...";
    } else {
        screenBtn.disabled = false;

        screenBtn.textContent =
            screenBtn.dataset.originalText ||
            "Screen Resume";
    }
}


// ============================================
// DOWNLOAD RESULT
// ============================================

function downloadResult() {
    if (!currentResult) {
        showToast(
            "No screening result available.",
            "warning"
        );

        return;
    }

    const data = currentResult;

    const score =
        getBestScore(data);

    const ai =
        data.ai_analysis;

    let report = "";

    report +=
        "AI RESUME SCREENING REPORT\n";

    report +=
        "===========================\n\n";

    report +=
        `Resume: ${data.filename || "-"}\n`;

    report +=
        `Match Score: ${score}%\n`;

    report +=
        `Rule-Based Score: ${data.match_score ?? 0}%\n`;

    report +=
        `AI Analysis: ${
            ai
                ? "Available"
                : "Unavailable"
        }\n\n`;

    report +=
        "MATCHED SKILLS\n";

    report +=
        "--------------\n";

    report +=
        (data.matched_skills || [])
            .join(", ") ||
        "None";

    report += "\n\n";

    report +=
        "MISSING SKILLS\n";

    report +=
        "--------------\n";

    report +=
        (data.missing_skills || [])
            .join(", ") ||
        "None";

    report += "\n\n";

    if (ai) {
        report +=
            "AI SUMMARY\n";

        report +=
            "----------\n";

        report +=
            `${ai.summary || "N/A"}\n\n`;

        report +=
            "AI STRENGTHS\n";

        report +=
            "------------\n";

        report +=
            (ai.strengths || [])
                .join("\n") ||
            "None";

        report += "\n\n";

        report +=
            "AI RECOMMENDATIONS\n";

        report +=
            "------------------\n";

        report +=
            (ai.recommendations || [])
                .join("\n") ||
            "None";
    }

    const blob =
        new Blob(
            [report],
            {
                type:
                    "text/plain;charset=utf-8"
            }
        );

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement("a");

    link.href = url;

    link.download =
        "AI_Resume_Screening_Report.txt";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    showToast(
        "Report downloaded.",
        "success"
    );
}


// ============================================
// PRINT REPORT
// ============================================

function printReport() {
    if (!currentResult) {
        showToast(
            "No screening result available.",
            "warning"
        );

        return;
    }

    window.print();
}


// ============================================
// SESSION STORAGE
// ============================================

function saveSessionData() {
    try {
        sessionStorage.setItem(
            "screeningResults",
            JSON.stringify(
                screeningResults
            )
        );
    } catch (error) {
        console.error(
            "Session storage error:",
            error
        );
    }
}


function loadSessionData() {
    try {
        const saved =
            sessionStorage.getItem(
                "screeningResults"
            );

        if (saved) {
            screeningResults =
                JSON.parse(saved);
        }

    } catch (error) {
        console.error(
            "Could not load session data:",
            error
        );

        screeningResults = [];
    }
}


// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(
    message,
    type = "info"
) {
    let toastStack =
        document.getElementById(
            "toastStack"
        );

    if (!toastStack) {
        toastStack =
            document.createElement(
                "div"
            );

        toastStack.id =
            "toastStack";

        toastStack.style.position =
            "fixed";

        toastStack.style.top =
            "20px";

        toastStack.style.right =
            "20px";

        toastStack.style.zIndex =
            "9999";

        document.body.appendChild(
            toastStack
        );
    }

    const toast =
        document.createElement(
            "div"
        );

    toast.className =
        `toast toast-${type}`;

    toast.style.marginBottom =
        "10px";

    toast.style.padding =
        "12px 18px";

    toast.style.borderRadius =
        "8px";

    toast.style.background =
        type === "error"
            ? "#dc2626"
            : type === "warning"
                ? "#d97706"
                : "#16a34a";

    toast.style.color =
        "#ffffff";

    toast.style.boxShadow =
        "0 4px 12px rgba(0,0,0,0.2)";

    toast.textContent =
        message;

    toastStack.appendChild(
        toast
    );

    setTimeout(() => {
        toast.remove();
    }, 4000);
}


// ============================================
// UTILITY FUNCTIONS
// ============================================

function getCandidateName(filename) {
    if (!filename) {
        return "Candidate";
    }

    const name =
        filename
            .replace(
                /\.[^/.]+$/,
                ""
            )
            .replace(
                /[_-]+/g,
                " "
            );

    return name;
}


function getCandidateInitials(filename) {
    const name =
        getCandidateName(filename);

    const words =
        name
            .split(" ")
            .filter(Boolean);

    if (words.length === 1) {
        return words[0]
            .substring(0, 2)
            .toUpperCase();
    }

    return (
        words[0][0] +
        words[words.length - 1][0]
    ).toUpperCase();
}


function escapeHTML(value) {
    if (value === null ||
        value === undefined) {
        return "";
    }

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener(
    "keydown",
    (event) => {

        // Ctrl + Enter = Screen Resume
        if (
            event.ctrlKey &&
            event.key === "Enter"
        ) {
            event.preventDefault();

            screenResume();
        }

        // Escape = Close sidebar
        if (
            event.key === "Escape"
        ) {
            closeSidebar();
        }
    }
);
function updateScreeningStatus(status, type = "success") {
    const statusElements = document.querySelectorAll(
        ".status-badge, .result-status, .screening-status"
    );

    statusElements.forEach((element) => {
        element.textContent = status;

        element.classList.remove(
            "waiting",
            "success",
            "error",
            "completed"
        );

        element.classList.add(type);
    });

    // Also find any element that currently says "Waiting"
    const allElements = document.querySelectorAll("*");

    allElements.forEach((element) => {
        if (
            element.children.length === 0 &&
            element.textContent.trim() === "Waiting"
        ) {
            element.textContent = status;

            element.classList.remove(
                "waiting",
                "success",
                "error"
            );

            element.classList.add(type);
        }
    });
}