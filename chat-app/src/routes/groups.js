const express = require('express')
const router = express.Router()
const groupController = require('../controllers/groupController')
const { authenticateToken } = require('../middleware/auth')
const { validateGroupName, validateInviteCode } = require('../middleware/validation')

// Wszystkie trasy wymagają autentykacji
router.use(authenticateToken)

// Tworzenie grupy
router.post('/', validateGroupName, groupController.createGroup)

// Pobieranie grup użytkownika
router.get('/my-groups', groupController.getUserGroups)

// Generowanie kodu zaproszeniowego do grupy
router.post('/:groupId/generate-invite', groupController.generateGroupInvite)

// Dołączanie do grupy używając kodu
router.post('/join', validateInviteCode, groupController.requestJoinGroup)

// Zarządzanie członkami grupy (tylko twórca)
router.get('/:groupId/pending', groupController.getPendingRequests)
router.post('/:groupId/members/:memberId/accept', groupController.acceptMember)
router.delete('/:groupId/members/:memberId/reject', groupController.rejectMember)
router.delete('/:groupId/members/:memberId/remove', groupController.removeMember)

// Pobieranie listy członków
router.get('/:groupId/members', groupController.getGroupMembers)

// Opuszczanie grupy
router.post('/:groupId/leave', groupController.leaveGroup)

// Zmiana nazwy grupy (tylko twórca)
router.put('/:groupId/name', validateGroupName, groupController.updateGroupName)

// Usuwanie grupy (tylko twórca)
router.delete('/:groupId', groupController.deleteGroup)

router.get('/:groupId', authenticateToken, groupController.getGroupDetails)

router.post('/:groupId/initialize-encryption', groupController.initializeGroupEncryption)

router.post('/:groupId/members/:memberId/add-key', groupController.addKeyForMember)

module.exports = router
