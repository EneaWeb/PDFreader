<?php
$id_rivista = isset($_GET['i']) ? $_GET['i'] : '';
$num_rivista = isset($_GET['n']) ? $_GET['n'] : '';

## 
## ERROR 0009
##
if ($id_rivista == '' || $num_rivista == '') {
	echo 'Errore 0009. Valori inesistenti.';
	exit();
}
##

try {
    $dbh = new PDO('mysql:host=46.37.12.19;dbname=admin_spreanewdb', 'admin_shopnew', 'nGY96@l8');
    foreach($dbh->query('SELECT * from pdfs WHERE id_rivista = $id_rivista AND num_rivista = $num_rivista') as $row) {
        print_r($row);
    }
    $dbh = null;
} catch (PDOException $e) {
   print "Error!: " . $e->getMessage() . "<br/>";
   die();
}