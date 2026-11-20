/**
 * js/ui.js
 * DOM rendering, filter operations, modal management, and alert handling.
 */

import { 
    getTickets, 
    addTicket, 
    updateTicket, 
    deleteTicket, 
    calculateMetrics, 
    VALID_TRANSITIONS, 
    PRIORITY_RANK, 
    resetToSeedData 
} from './store.js';
import { processNextQueueTicket, getSortedPendingQueue } from './queue.js';

export function initUI() {
    setupTabNavigation();
    setupEventListeners();
    renderAll();
}

export function renderAll() {
    renderTicketsTable();
    renderQueueTable();
    renderMetrics();
}

function setupTabNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function setupEventListeners() {
    // Ticket Creation Form
    document.getElementById('ticket-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            studentName: document.getElementById('student-name').value,
            studentId: document.getElementById('student-id').value,
            category: document.getElementById('ticket-category').value,
            priority: document.getElementById('ticket-priority').value,
            estimatedHours: document.getElementById('estimated-hours').value,
            description: document.getElementById('ticket-desc').value
        };
        const res = addTicket(data);
        if (res.success) {
            showAlert(`Created Ticket [${res.ticket.id}] successfully.`, 'success');
            document.getElementById('ticket-form').reset();
            renderAll();
        } else {
            showAlert(`Error: ${res.message}`, 'danger');
        }
    });

    // Filtering and Searching Listeners
    ['search-input', 'filter-category', 'filter-priority', 'filter-status', 'sort-by'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderTicketsTable);
    });

    // Queue Processing Button
    document.getElementById('process-queue-btn').addEventListener('click', () => {
        const res = processNextQueueTicket();
        if (res.success) {
            showAlert(`Processed Ticket [${res.ticket.id}] (${res.ticket.studentName}) to IN PROGRESS.`, 'success');
            renderAll();
        } else {
            showAlert(res.message, 'info');
        }
    });

    // Reset Data Button
    document.getElementById('reset-data-btn').addEventListener('click', () => {
        resetToSeedData();
        renderAll();
        showAlert('Data reset to default sample records.', 'info');
    });

    // Edit Modal Event Handlers
    document.getElementById('edit-form').addEventListener('submit', handleUpdateSubmit);
    document.getElementById('close-modal-btn').addEventListener('click', closeModal);
}

export function getFilteredAndSortedTickets() {
    const searchQuery = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const categoryFilter = document.getElementById('filter-category')?.value || 'ALL';
    const priorityFilter = document.getElementById('filter-priority')?.value || 'ALL';
    const statusFilter = document.getElementById('filter-status')?.value || 'ALL';
    const sortBy = document.getElementById('sort-by')?.value || 'date-desc';

    return getTickets().filter(t => {
        const matchesSearch = !searchQuery || 
            t.studentName.toLowerCase().includes(searchQuery) ||
            t.studentId.toLowerCase().includes(searchQuery) ||
            t.id.toLowerCase().includes(searchQuery) ||
            t.description.toLowerCase().includes(searchQuery);

        const matchesCategory = categoryFilter === 'ALL' || t.category === categoryFilter;
        const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
        const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;

        return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
    }).sort((a, b) => {
        if (sortBy === 'date-desc') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'date-asc') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'priority') return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (sortBy === 'hours') return b.estimatedHours - a.estimatedHours;
        if (sortBy === 'name') return a.studentName.localeCompare(b.studentName);
        return 0;
    });
}

function renderTicketsTable() {
    const list = getFilteredAndSortedTickets();
    const tbody = document.getElementById('tickets-table-body');
    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No matching service requests found.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(t => `
        <tr>
            <td><strong>${t.id}</strong></td>
            <td>${escapeHtml(t.studentName)}</td>
            <td><code>${escapeHtml(t.studentId)}</code></td>
            <td>${t.category}</td>
            <td>${t.priority}</td>
            <td>${t.status}</td>
            <td>${t.estimatedHours} hrs</td>
            <td>${new Date(t.createdAt).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-secondary btn-edit" data-id="${t.id}">Edit</button>
                <button class="btn btn-danger btn-del" data-id="${t.id}">Delete</button>
            </td>
        </tr>
    `).join('');

    // Attach Row Action Buttons
    tbody.querySelectorAll('.btn-edit').forEach(b => {
        b.addEventListener('click', () => openEditModal(b.getAttribute('data-id')));
    });
    tbody.querySelectorAll('.btn-del').forEach(b => {
        b.addEventListener('click', () => {
            const id = b.getAttribute('data-id');
            if (confirm(`Delete ticket ${id}?`)) {
                deleteTicket(id);
                renderAll();
                showAlert(`Deleted ticket [${id}].`, 'info');
            }
        });
    });
}

function renderQueueTable() {
    const queue = getSortedPendingQueue();
    const tbody = document.getElementById('queue-table-body');
    if (queue.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">Queue is empty.</td></tr>`;
        return;
    }

    tbody.innerHTML = queue.map((t, idx) => `
        <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td>${t.id}</td>
            <td>${escapeHtml(t.studentName)}</td>
            <td>${t.category}</td>
            <td>${t.priority}</td>
            <td>${t.estimatedHours} hrs</td>
            <td>${new Date(t.createdAt).toLocaleString()}</td>
        </tr>
    `).join('');
}

function renderMetrics() {
    const metrics = calculateMetrics();
    document.getElementById('metric-total').innerText = metrics.total;
    document.getElementById('metric-pending').innerText = metrics.pending;
    document.getElementById('metric-progress').innerText = metrics.progress;
    document.getElementById('metric-resolved').innerText = metrics.resolved;
    document.getElementById('metric-avg-hours').innerText = metrics.avgHours;
}

function openEditModal(id) {
    const ticket = getTickets().find(t => t.id === id);
    if (!ticket) return;

    document.getElementById('edit-ticket-id').value = ticket.id;
    document.getElementById('edit-display-id').value = ticket.id;
    document.getElementById('edit-priority').value = ticket.priority;
    document.getElementById('edit-hours').value = ticket.estimatedHours;
    document.getElementById('edit-desc').value = ticket.description;

    const statusSelect = document.getElementById('edit-status');
    const allowed = VALID_TRANSITIONS[ticket.status] || [ticket.status];
    statusSelect.innerHTML = allowed.map(s => 
        `<option value="${s}" ${s === ticket.status ? 'selected' : ''}>${s}</option>`
    ).join('');

    document.getElementById('edit-modal').hidden = false;
}

function closeModal() {
    document.getElementById('edit-modal').hidden = true;
}

function handleUpdateSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-ticket-id').value;
    const fields = {
        status: document.getElementById('edit-status').value,
        priority: document.getElementById('edit-priority').value,
        estimatedHours: document.getElementById('edit-hours').value,
        description: document.getElementById('edit-desc').value
    };

    const res = updateTicket(id, fields);
    if (res.success) {
        showAlert(`Ticket [${id}] updated.`, 'success');
        closeModal();
        renderAll();
    } else {
        showAlert(`Update failed: ${res.message}`, 'danger');
    }
}

export function showAlert(msg, type = 'info') {
    const box = document.getElementById('alert-box');
    box.innerText = msg;
    box.hidden = false;
    setTimeout(() => { box.hidden = true; }, 4000);
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}