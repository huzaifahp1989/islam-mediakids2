// Admin Dashboard JavaScript
class AdminDashboard {
    constructor() {
        this.apiBase = '/api';
        this.token = localStorage.getItem('adminToken');
        this.currentSection = 'dashboard';
        
        this.init();
    }
    
    init() {
        // Check if user is already logged in
        if (this.token) {
            this.verifyToken();
        } else {
            this.showLogin();
        }
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });
        
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.logout();
        });
        
        // Sidebar navigation
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('.nav-link').dataset.section;
                this.showSection(section);
            });
        });
        
        // Content type filter
        document.getElementById('contentTypeFilter').addEventListener('change', () => {
            this.loadContent();
        });
    }
    
    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('loginError');
        
        try {
            const response = await fetch(`${this.apiBase}/auth/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                localStorage.setItem('adminToken', this.token);
                document.getElementById('adminUsername').textContent = data.user.username;
                this.showDashboard();
                this.loadDashboardData();
            } else {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Connection error. Please try again.';
            errorDiv.classList.remove('hidden');
        }
    }
    
    async verifyToken() {
        try {
            const response = await fetch(`${this.apiBase}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            const data = await response.json();
            
            if (data.valid && data.user.role === 'admin') {
                document.getElementById('adminUsername').textContent = data.user.username;
                this.showDashboard();
                this.loadDashboardData();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Token verification error:', error);
            this.logout();
        }
    }
    
    logout() {
        localStorage.removeItem('adminToken');
        this.token = null;
        this.showLogin();
    }
    
    showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('loginError').classList.add('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    }
    
    showDashboard() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
    }
    
    showSection(section) {
        // Update sidebar active state
        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${section}"]`).classList.add('active');
        
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(sec => {
            sec.classList.add('hidden');
        });
        
        // Show selected section
        document.getElementById(`${section}Section`).classList.remove('hidden');
        this.currentSection = section;
        
        // Load section-specific data
        switch (section) {
            case 'dashboard':
                this.loadDashboardData();
                break;
            case 'content':
                this.loadContent();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'uploads':
                this.loadFiles();
                break;
            case 'images':
                this.loadImages();
                break;
        }
    }
    
    async loadDashboardData() {
        try {
            // Load statistics
            const [usersRes, contentRes, filesRes] = await Promise.all([
                this.apiCall('/users/admin/all'),
                this.apiCall('/content/admin/all'),
                this.apiCall('/upload/list')
            ]);
            
            if (usersRes.success !== false) {
                document.getElementById('totalUsers').textContent = usersRes.length || 0;
                const totalPoints = usersRes.reduce((sum, user) => sum + (user.points || 0), 0);
                document.getElementById('totalPoints').textContent = totalPoints;
            }
            
            if (contentRes.success !== false) {
                document.getElementById('totalContent').textContent = contentRes.length || 0;
            }
            
            if (filesRes.success !== false) {
                document.getElementById('totalFiles').textContent = filesRes.files?.length || 0;
            }
        } catch (error) {
            console.error('Dashboard data loading error:', error);
        }
    }
    
    async loadContent() {
        const typeFilter = document.getElementById('contentTypeFilter').value;
        const tbody = document.getElementById('contentTableBody');
        
        try {
            let url = '/content/admin/all';
            if (typeFilter) {
                url += `?type=${typeFilter}`;
            }
            
            const content = await this.apiCall(url);
            
            tbody.innerHTML = '';
            
            if (Array.isArray(content)) {
                content.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${item.id}</td>
                        <td><span class="badge bg-primary">${item.type}</span></td>
                        <td>${item.title || '-'}</td>
                        <td>${this.truncateText(item.content_en || item.content_ar || '', 50)}</td>
                        <td>
                            <span class="badge ${item.is_active ? 'bg-success' : 'bg-secondary'}">
                                ${item.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="admin.editContent(${item.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-warning me-1" onclick="admin.toggleContent(${item.id})">
                                <i class="fas fa-toggle-${item.is_active ? 'on' : 'off'}"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="admin.deleteContent(${item.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Content loading error:', error);
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Error loading content</td></tr>';
        }
    }
    
    async loadUsers() {
        const tbody = document.getElementById('usersTableBody');
        
        try {
            const users = await this.apiCall('/users/admin/all');
            
            tbody.innerHTML = '';
            
            if (Array.isArray(users)) {
                users.forEach(user => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${user.username}</td>
                        <td>${user.email}</td>
                        <td>${user.madrasah || '-'}</td>
                        <td>${user.age || '-'}</td>
                        <td><span class="badge bg-success">${user.points || 0}</span></td>
                        <td>${new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-info" onclick="admin.viewUserPoints('${user.id}')">
                                <i class="fas fa-star"></i> Points
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            }
        } catch (error) {
            console.error('Users loading error:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Error loading users</td></tr>';
        }
    }
    
    async loadFiles() {
        const tbody = document.getElementById('filesTableBody');
        
        try {
            const response = await this.apiCall('/upload/list');
            const files = response.files || [];
            
            tbody.innerHTML = '';
            
            files.forEach(file => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <a href="${file.url}" target="_blank" class="text-decoration-none">
                            ${file.filename}
                        </a>
                    </td>
                    <td>${this.formatFileSize(file.size)}</td>
                    <td>${new Date(file.created).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger" onclick="admin.deleteFile('${file.filename}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Files loading error:', error);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Error loading files</td></tr>';
        }
    }
    
    showAddContentModal() {
        const modal = new bootstrap.Modal(document.getElementById('addContentModal'));
        document.getElementById('addContentForm').reset();
        document.getElementById('contentImageUrl').value = '';
        document.getElementById('contentImageSelect').classList.add('hidden');
        document.getElementById('contentImagePreview').classList.add('d-none');
        document.getElementById('contentImagePreview').src = '';
        this.bindImageSelectorEvents();
        modal.show();
    }
    
    async saveContent() {
        const form = document.getElementById('addContentForm');
        const formData = new FormData(form);
        
        const contentData = {
            type: document.getElementById('contentType').value,
            title: document.getElementById('contentTitle').value,
            content_ar: document.getElementById('contentArabic').value,
            content_en: document.getElementById('contentEnglish').value,
            reference: document.getElementById('contentReference').value,
            category: document.getElementById('contentCategory').value,
            image_url: document.getElementById('contentImageUrl').value || null,
            sort_order: parseInt(document.getElementById('sortOrder').value) || 0
        };
        
        try {
            const response = await this.apiCall('/content/admin/create', 'POST', contentData);
            
            if (response.success) {
                bootstrap.Modal.getInstance(document.getElementById('addContentModal')).hide();
                this.showAlert('Content added successfully!', 'success');
                this.loadContent();
            } else {
                this.showAlert(response.error || 'Failed to add content', 'danger');
            }
        } catch (error) {
            console.error('Save content error:', error);
            this.showAlert('Error saving content', 'danger');
        }
    }

    bindImageSelectorEvents() {
        const loadBtn = document.getElementById('loadImageOptionsBtn');
        const selectEl = document.getElementById('contentImageSelect');
        const urlInput = document.getElementById('contentImageUrl');
        const previewImg = document.getElementById('contentImagePreview');

        loadBtn.onclick = async () => {
            try {
                const response = await this.apiCall('/upload/list');
                const images = (response.files || []).filter(f => f.url.match(/\.(png|jpe?g|gif|webp|svg)$/i));
                selectEl.innerHTML = '<option value="">Select an image...</option>';
                images.forEach(img => {
                    const opt = document.createElement('option');
                    opt.value = img.url;
                    opt.textContent = `${img.filename} (${this.formatFileSize(img.size)})`;
                    selectEl.appendChild(opt);
                });
                selectEl.classList.remove('hidden');
            } catch (error) {
                console.error('Load image options error:', error);
                this.showAlert('Failed to load images', 'danger');
            }
        };

        selectEl.onchange = () => {
            const url = selectEl.value;
            urlInput.value = url;
            if (url) {
                previewImg.src = url;
                previewImg.classList.remove('d-none');
            } else {
                previewImg.classList.add('d-none');
                previewImg.src = '';
            }
        };
    }
    
    async toggleContent(id) {
        try {
            const response = await this.apiCall(`/content/admin/${id}/toggle`, 'PATCH');
            
            if (response.success) {
                this.showAlert('Content status updated!', 'success');
                this.loadContent();
            } else {
                this.showAlert(response.error || 'Failed to update content', 'danger');
            }
        } catch (error) {
            console.error('Toggle content error:', error);
            this.showAlert('Error updating content', 'danger');
        }
    }
    
    async deleteContent(id) {
        if (!confirm('Are you sure you want to delete this content?')) return;
        
        try {
            const response = await this.apiCall(`/content/admin/${id}`, 'DELETE');
            
            if (response.success) {
                this.showAlert('Content deleted successfully!', 'success');
                this.loadContent();
            } else {
                this.showAlert(response.error || 'Failed to delete content', 'danger');
            }
        } catch (error) {
            console.error('Delete content error:', error);
            this.showAlert('Error deleting content', 'danger');
        }
    }
    
    async uploadFiles() {
        const fileInput = document.getElementById('fileInput');
        const files = fileInput.files;
        
        if (files.length === 0) return;
        
        const formData = new FormData();
        for (let file of files) {
            formData.append('files', file);
        }
        
        const progressBar = document.querySelector('#uploadProgress .progress-bar');
        const progressContainer = document.getElementById('uploadProgress');
        
        try {
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '0%';
            
            const response = await fetch(`${this.apiBase}/upload/multiple`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });
            
            progressBar.style.width = '100%';
            
            const result = await response.json();
            
            if (result.success) {
                this.showAlert(`${result.files.length} files uploaded successfully!`, 'success');
                this.loadFiles();
            } else {
                this.showAlert(result.error || 'Upload failed', 'danger');
            }
        } catch (error) {
            console.error('Upload error:', error);
            let errorMsg = 'Upload failed';
            if (error.response && error.response.data && error.response.data.error) {
                errorMsg = error.response.data.error;
            } else if (error.message) {
                errorMsg = error.message;
            }
            this.showAlert(errorMsg, 'danger');
        } finally {
            progressContainer.classList.add('hidden');
            fileInput.value = '';
        }
    }

    async loadImages() {
        const grid = document.getElementById('imagesGrid');
        try {
            const response = await this.apiCall('/upload/list');
            const files = (response.files || []).filter(f => f.url.match(/\.(png|jpe?g|gif|webp|svg)$/i));
            grid.innerHTML = '';
            if (files.length === 0) {
                grid.innerHTML = '<div class="col-12 text-muted">No images uploaded yet.</div>';
                return;
            }
            files.forEach(file => {
                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3';
                col.innerHTML = `
                    <div class="card h-100">
                        <img src="${file.url}" class="card-img-top" alt="${file.filename}">
                        <div class="card-body p-2 d-flex justify-content-between align-items-center">
                            <small class="text-muted">${this.formatFileSize(file.size)}</small>
                            <button class="btn btn-sm btn-outline-danger" onclick="admin.deleteFile('${file.filename}'); admin.loadImages();">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(col);
            });
        } catch (error) {
            console.error('Images loading error:', error);
            grid.innerHTML = '<div class="col-12 text-center text-muted">Error loading images</div>';
        }
    }

    async uploadImages() {
        const input = document.getElementById('imageInput');
        const files = input.files;
        if (files.length === 0) return;
        const preview = document.getElementById('imagePreview');
        const progressBar = document.querySelector('#uploadImagesProgress .progress-bar');
        const progressContainer = document.getElementById('uploadImagesProgress');

        // Client-side preview
        preview.innerHTML = '';
        preview.classList.remove('hidden');
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const col = document.createElement('div');
                col.className = 'col-6 col-md-4 col-lg-3';
                col.innerHTML = `<img src="${e.target.result}" class="img-fluid rounded" alt="preview">`;
                preview.appendChild(col);
            };
            reader.readAsDataURL(file);
        });

        const formData = new FormData();
        Array.from(files).forEach(file => formData.append('files', file));

        try {
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '0%';

            const response = await fetch(`${this.apiBase}/upload/multiple`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.token}` },
                body: formData
            });

            progressBar.style.width = '100%';
            const result = await response.json();
            if (result.success) {
                this.showAlert(`${result.files.length} image(s) uploaded successfully!`, 'success');
                preview.classList.add('hidden');
                preview.innerHTML = '';
                input.value = '';
                this.loadImages();
            } else {
                this.showAlert(result.error || 'Upload failed', 'danger');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            let errorMsg = 'Upload failed';
            if (error.response && error.response.data && error.response.data.error) {
                errorMsg = error.response.data.error;
            } else if (error.message) {
                errorMsg = error.message;
            }
            this.showAlert(errorMsg, 'danger');
        } finally {
            progressContainer.classList.add('hidden');
        }
    }
    async deleteFile(filename) {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;
        
        try {
            const response = await this.apiCall(`/upload/${filename}`, 'DELETE');
            
            if (response.success) {
                this.showAlert('File deleted successfully!', 'success');
                this.loadFiles();
            } else {
                this.showAlert(response.error || 'Failed to delete file', 'danger');
            }
        } catch (error) {
            console.error('Delete file error:', error);
            this.showAlert('Error deleting file', 'danger');
        }
    }
    
    async refreshDashboard() {
        this.showAlert('Refreshing dashboard...', 'info');
        await this.loadDashboardData();
        this.showAlert('Dashboard refreshed!', 'success');
    }
    
    // Utility methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${this.apiBase}${endpoint}`, options);
        
        if (response.status === 401) {
            this.logout();
            throw new Error('Unauthorized');
        }
        
        return await response.json();
    }
    
    truncateText(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    showAlert(message, type = 'info') {
        // Create alert element
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }
}

// Global functions for onclick handlers
function showSection(section) {
    admin.showSection(section);
}

function showAddContentModal() {
    admin.showAddContentModal();
}

function saveContent() {
    admin.saveContent();
}

function uploadFiles() {
    admin.uploadFiles();
}

function uploadImages() {
    admin.uploadImages();
}

function refreshDashboard() {
    admin.refreshDashboard();
}

// Initialize admin dashboard
const admin = new AdminDashboard();