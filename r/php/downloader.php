<?php

if (isset($_GET['id_anagrafica']) && $_GET['id_anagrafica'] != '') {
	//
	var_dump(exec('curl -v http://pdf.sprea.it'));
}

exit();